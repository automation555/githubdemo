
import * as async from 'async';
import _ from 'underscore';

import {pathSqlExp} from '../../../services/nodes';
let sqlQuery;


export async function getTagwiseHotspotDistribution(req, res, next) {
    var hotspotC= (cb)=> {
        sqlQuery =`
            select
            nodes.id,
            nodes.path,
            measurements.value as loc,
            ratings_values.rating_value as rating
            from nodes
            INNER JOIN node_types ON (nodes.nodetype=node_types.id)
            INNER JOIN measurements ON (nodes.id=measurements.nodeid)
            INNER JOIN snapshots ON (measurements.snapshotid = snapshots.id)
            INNER JOIN ratings_values ON (snapshots.id = ratings_values.snapshotid and nodes.id=ratings_values.nodeid)
            INNER JOIN ratings ON (ratings_values.ratingid = ratings.id)
            INNER JOIN subsystems ON (subsystems.id = snapshots.subsystem_id)
            where node_types.classification='COMPONENTS'
            and nodes.path like ${pathSqlExp('$1')}
            and nodes.excluded=false
            AND measurements.measureid = (SELECT id FROM   measures WHERE  measurename = 'NOS')
            AND snapshots.id = $2
            AND subsystems.id = $3
            AND ratings.rating = 'overallRating'
            order by nodes.id asc;
        `;

        req.corona.query(sqlQuery, [req.query.node_id, req.query.snapshot_id, req.query.project_id],next)
        .then(data=>{
            var nodePaths = {};
            data.forEach(d => {
                nodePaths[d.id] = d.path.split('.').map(d => d - 0);
                nodePaths[d.id].unshift(-1);
                d.rating = d.rating - 0;
                if (d.rating < 0 && d.rating > -1.0) d.type = 'mediumHotspots';
                else if (d.rating <= -1.0 && d.rating > -2.0) d.type = 'highHotspots';
                else if (d.rating <= -2.0) d.type = 'criticalHotspots';
                else if (d.rating >= 0) d.type = 'notHotspots';
                delete d.path;
            });
            var componentHotspot = _.groupBy(data, 'id');
            cb(null, { path: nodePaths, info: data });
        });
    }

    var allTagsC= (cb)=>{
        var sqlQuery = `
            SELECT tags.name, tags.tag_uid
            FROM tags, tag_category
            WHERE tags.category_id = tag_category.id
            and tag_category.id=$1
        `;

        req.gamma.query(sqlQuery, [req.query.category],next)
        .then(data=>{
            cb(null, _.indexBy(data, 'tag_uid'));
        });
    }

    var nodeTags=(results)=>{

        if (_.isEmpty(results.tags))
        return res.json([]);
        var nodeIds = _.uniq(_.flatten(_.values(results.hotspot.path))).join(',');
        var inTagUids=_.keys(results.tags).map(d=>`'${d}'`).join(',');

        sqlQuery =`
                select nt.node_id,nt.tag_uid
                from node_tags nt
                where
                nt.tag_uid in (${inTagUids})
                and nt.node_id in (${nodeIds})
                `;

        return req.corona.query(sqlQuery, [],next)
            .then(tag_uids => {
                var pairs=_.indexBy(tag_uids,'node_id');
                pairs[-1]={name:"none"};
                var tagsPair={};
                _.each(results.hotspot.path,(v,k)=>{
                    tagsPair[k]=results.tags[_.last(_.compact(v.map(d=>pairs[d]))).tag_uid];
                })
                var tagwiseData;
                results.hotspot.info.forEach(d=>{
                    if(tagsPair[d.id])
                    {
                        d.tag=tagsPair[d.id].name;
                    }
                    else
                        d.tag="none"
                })
                tagwiseData=[];
                var tagsIdIndex = _.values(results.tags);

                _.each(_.groupBy(results.hotspot.info,'tag'),(v,k)=>{
                    var item = { name: k};
                    item.hotspotinfo=[];
                    _.each(_.groupBy(v,'type'),(v2,k2)=>{
                        var summary={type:k2};
                        summary.loc= _.reduce(v2, (sum, d)=> sum + (d.loc-0), 0);
                        summary.count= _.reduce(v2, (sum, d)=> sum + 1, 0);
                        item.hotspotinfo.push(summary)
                    })

                    var typeOrder = ["criticalHotspots", "highHotspots", "mediumHotspots", "notHotspots"]

                    item.hotspotinfo = _.sortBy(item.hotspotinfo,d=>typeOrder.indexOf(d.type));

                    var tagObj = tagsIdIndex.find(d => d.name == k);
                    if (tagObj)
                        item.tagId = tagObj.tag_uid;
                    else
                        item.tagId = -1;
                    tagwiseData.push(item)
                });
                return _.reject(tagwiseData,d=>d.name=='none');
            });
    }
    async
        .parallelAsync({
            hotspot: hotspotC,
            tags: allTagsC
        })
        .then(results => {
            nodeTags(results)
                .then(data => {
                    res.json(data)
                });
        });
}


export async function getHotspotDistribution(req,res,next) {
    //var connectionString = `postgres://${gammaConfig.analysisDBDetails.dbUsername}:${gammaConfig.analysisDBDetails.dbPassword}@${gammaConfig.analysisDBDetails.dbHostname}:${gammaConfig.analysisDBDetails.dbPort}/corona_base${req.query.user_id}`;
    var hotspot = [
        {
            'snapshot_id' : '',
            'dataList'    : []
        }
    ];
    async.parallel({
        module_hotspot_detail_snap1: function(callback)
        {
            sqlQuery = `select * from get_hotspot_distribution($1,$2,$3)
                                            order by CASE when (hotspotinfo->0->'loc')::text::int is null then 0 else (hotspotinfo->0->'loc')::text::int end + CASE
                                            when (hotspotinfo->1->'loc')::text::int is null then 0 else (hotspotinfo->1->'loc')::text::int END + CASE
                                            when (hotspotinfo->2->'loc')::text::int is null then 0 else (hotspotinfo->2->'loc')::text::int end+ CASE
                                            when (hotspotinfo->3->'loc')::text::int is null then 0 else (hotspotinfo->3->'loc')::text::int end desc`;
            req.corona.query(sqlQuery, [req.query.node_id, req.query.project_id, req.query.snapshot_id],next)
            .then(data=>{
                data = _.uniq(data, 'name');
                callback(null, data);
            });
        },
        component_hotspot_detail_snap1: function(callback)
        {
            sqlQuery = `select * from get_hotspot_distribution_components($1,$2,$3)`;
            req.corona.query(sqlQuery, [req.query.node_id, req.query.project_id, req.query.snapshot_id])
            .then(data=>{
                callback(null, data);
            });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results) {
        
        var components          = { 'components_hotspot_detail' : { }  };
        hotspot[0].snapshot_id  = req.query.snapshot_id;
        // without rating
        if (results.module_hotspot_detail_snap1[0].id != null)
            hotspot[0].dataList.push(results.module_hotspot_detail_snap1);
        else
            hotspot[0].dataList.push("");

        components.components_hotspot_detail = results.component_hotspot_detail_snap1;
        hotspot[0].dataList.push(components);
        res.json(hotspot);
        
    });
}
