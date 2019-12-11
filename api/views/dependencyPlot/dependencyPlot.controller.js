import * as cf from '../../../utils/common-functions';
import async from 'async';
var sqlQuery;

export async function getDependencyPlot(req,res,next)
{
    // define json
    var dependencyPlotJson =
    {
        "name"   : "",
        "no"	 : "",
        "type"	 : "",
        "sig"	 : "",
        "children" : []
    };

    async.parallel({
        incoming_dependencies_details: function(callback)
        {
            sqlQuery = `select name, sig,  type, rating,dependency_count,random() as id,id as no from get_node_incoming_dependencies($1,$2,$3)`;
            req.corona.query(sqlQuery, [req.query.project_id, req.query.snapshot_id, req.query.component_id],next)
                .then(data => {
                    callback(null, data);
                });
        },
        outgoing_dependencies_details: function(callback)
        {
            sqlQuery = `select name, sig,  type, rating,dependency_count,random() as id,id as no from get_node_outgoing_dependencies($1,$2,$3)`;
            req.corona.query(sqlQuery, [req.query.project_id, req.query.snapshot_id, req.query.component_id],next)
                .then(data => {
                    callback(null, data);
                });
        },
        component_details: function(callback)
        {
            sqlQuery = `select n.id as no, n.displayname as component_name, nt.name as component_type,rv.rating_value as component_rating,n.signature as sig from  nodes n
                        INNER JOIN node_types nt ON nt.id=n.nodetype
                        INNER JOIN ratings_values rv on rv.nodeid=n.id
                        and rv.snapshotid=$1 and rv.ratingid=(select r.id from ratings r where r.rating='overallRating')
                        and n.excluded = false
                        and n.id=$2`;
            req.corona.query(sqlQuery, [req.query.snapshot_id, req.query.component_id],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
        if(results.component_details != null && results.component_details != '')
        {
            // assign fetched data to json
            dependencyPlotJson.no     = results.component_details[0].no;
            dependencyPlotJson.name   = results.component_details[0].component_name;
            dependencyPlotJson.type   = results.component_details[0].component_type;
            dependencyPlotJson.sig    = results.component_details[0].sig;
            dependencyPlotJson.rating = cf.convertToRange(results.component_details[0].component_rating);
        }

        if (req.query.type == 'incoming' || req.query.type == 'all'){
            if(results.incoming_dependencies_details != null && results.incoming_dependencies_details != '')
            dependencyPlotJson.children = cf.convertRatingsToRange(results.incoming_dependencies_details);

        }
        else if (req.query.type == 'outgoing' || req.query.type == 'all'){
            if(results.outgoing_dependencies_details != null && results.outgoing_dependencies_details != '')
            dependencyPlotJson.children = cf.convertRatingsToRange(results.outgoing_dependencies_details);
        }
        var depedencyName;
        (dependencyPlotJson.children).map(d => {
            depedencyName = d.name;
            if (depedencyName.length > 25) {
                depedencyName = depedencyName.slice(0, 25);
                depedencyName += "...";
                d.name = depedencyName;
            }
        });
        res.json(dependencyPlotJson);

    });
}