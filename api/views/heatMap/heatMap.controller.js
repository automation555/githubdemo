
import config from '../../../core/config';
import async from 'async';
let sqlQuery;
export async function getHeatmap(req,res,next) {
  
    async.parallel({
        heatmap_details: function(callback)
        {
            sqlQuery = `select * from get_heatmap($1,$2,$3,${config.componentCount},${config.maxLoc})`;
            req.corona.query(sqlQuery, [req.query.node_id, req.query.project_id, req.query.snapshot_id],next)
                .then(data => {
                    callback(null, data);
                });
        },
        heatmap_loc_details: function(callback)
        {
            sqlQuery = `select * from get_heatmap_min_max_loc($1,$2)`;
            req.corona.query(sqlQuery, [req.query.node_id, req.query.snapshot_id],next)
                .then(data => {
                    callback(null, data);
                });
        },
        node_components_count:function(callback)
        {
          	sqlQuery = `select * from get_node_components_count($1,$2,$3)`;
              req.corona.query(sqlQuery, [req.query.project_id, req.query.snapshot_id, req.query.node_id],next)
                  .then(data => {
                      callback(null, data);
                  });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){

        var componentsCount = 0,tree;
        if(results.heatmap_details != null && results.heatmap_details != '')
        {
            tree                    = _makeTree({q: results.heatmap_details},next);
            //var tree                 = results.heatmap_details;
            tree[0].max_loc          = results.heatmap_loc_details.max_loc;
            tree[0].min_loc          = results.heatmap_loc_details.min_loc;
            tree[0].min_loc          = results.heatmap_loc_details.min_loc;
            tree[0].components_count = results.node_components_count[0].components;
            componentsCount         = results.node_components_count[0].components;
        }
        var componentsCount = 0,tree;
        if(results.heatmap_details != null && results.heatmap_details != '')
        {
            tree                    = _makeTree({q: results.heatmap_details},next);
            //var tree                 = results.heatmap_details;
            tree[0].max_loc          = results.heatmap_loc_details.max_loc;
            tree[0].min_loc          = results.heatmap_loc_details.min_loc;
            tree[0].min_loc          = results.heatmap_loc_details.min_loc;
            tree[0].components_count = results.node_components_count[0].components;
            componentsCount         = results.node_components_count[0].components;
        }

        var resultJson =
        {
            "id" : 0,
            "name": "root",
            "type": "root_type",
            "sig": "root_sig",
            "parentid": 0,
            "rating": null,
            "size": null,
            "components_count": componentsCount
        };
        resultJson.children = tree;
        res.json(resultJson);

    });
}


var _makeTree = function(options,next) {
      var children, e, id, o, pid, temp, i, len, _ref, parent;
      id = options.id || "id";
      pid = options.parentid || "parentid";
      children = options.children || "children";
      temp = {};
      o = [];
      parent = [];
      _ref = options.q;

      for (var i = 0, len = _ref.length; i < len; i++) {
          parent[_ref[i].parentid] = _ref[i];
      }

      for (var i = 0, len = _ref.length; i < len; i++) {
          e = _ref[i];

          if (parent[e[id]] != null)
              e[children] = [];

          temp[e[id]] = e;

          if (temp[e[pid]] != null) {
              if(e.type == 'COMPONENTS' && temp[e[pid]].type == 'COMPONENTS') {
                  var eid = e[pid];

                  while(true) {
                      if(temp[eid] && temp[eid].parentid && temp[temp[eid].parentid] && temp[eid].type == 'COMPONENTS' && temp[temp[eid].parentid].type == 'COMPONENTS') {
                        eid = temp[eid].parentid;
                      }
                      else {
                        break;
                      }
                    }

                  temp[eid].size = parseInt(temp[eid].size) + parseInt(e.size);
              }
              else{
                if(e.type == 'MODULES'){
                delete e.type;
                delete e.sig;
                delete e.name;
                delete e.rating;

                }


                temp[e[pid]][children].push(e);
              }
          } else {
              o.push(e);
          }
      }

  if(o[0].type == 'COMPONENTS') {
    for (var i = 1, len = _ref.length; i < len; i++) {
      e = _ref[i];

      if(o[0].id == e.parentid) {
        o[0][children].push(e);
      }

    }
  }

  return o;

};
