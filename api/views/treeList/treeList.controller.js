let sqlQuery;
const errors = require('throw.js');

//Get tree data for subcomponents
export async function getSubcomponentData(req, res, next) {
    sqlQuery = `select * from node_file where snapshot_id =$1 AND component_id=$2`;
    return req.corona.query(sqlQuery, [req.query.snapshotId, req.query.nodeId])
    .then(data => {
        if (data.length) {
            res.status(200).json(data);
        }
        else {
            return next(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
        }
    });
}

//Get path for node
export async function getNodePath(req, res, next) {
    /* to open tree nodes one by one */
    sqlQuery = `select path as path from nodes where id =$1`;
    return req.corona.query(sqlQuery, [req.query.nodeId])
    .then(data => {
        if (data.length) {
            res.status(200).json(data);
        }
        else {
            return next(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
        }
    });
}

//Get tree data
export async function getTreeData(req, res, next) {
    let selectNodeId = req.query.nodeId;
    let selectSnapshotId = req.query.snapshotId;
    let selectRepositoryId = req.query.projectId;

    if (selectSnapshotId == -1) {
        selectSnapshotId = null;
    }

    if (selectNodeId == '#') {
        selectNodeId = null;
        sqlQuery = `select DISTINCT *,(select p.subsystem_name from subsystems p where p.id=$1) from get_node_tree($1,$2,$3) ORDER BY id`;
        return req.corona.query(sqlQuery, [selectRepositoryId, selectNodeId, selectSnapshotId], next)
        .then(results => {
            if (results.length) {
                for (let i = 0, l = results.length; i < l; i++) {
                    if (results[i].type == "PROJECT") {
                        //previous root
                        results[i].text = gammaConfig.subsystem + results[i].projectname;
                        results[i].type = "MODULES";
                    }

                    if (results[i].children == null || results[i].type == "SUBCOMPONENTS") {
                        results[i].children = false;
                    }
                    if (results[i].parent == null || results[i].isroot == true) {
                        results[i].parent = "#";
                        delete results[i].children;
                    }
                    else {
                        results[i].parent = "tr-" + results[i].parent;	// add tr prefix
                    }

                    results[i].opened = false;
                    results[i].id = "tr-" + results[i].id;		// add tr prefix
                    results[i].title = (typeof results[i].text != "undefined") ? results[i].text.toLowerCase() : '';
                    let node_type = (results[i].node_type_name == 'Subsystem') ? 'Repository' : results[i].node_type_name;
                    results[i].a_attr = {
                        "class": "type-" + results[i].type.toLowerCase(),
                        "data-classification": results[i].type,
                        "data-nodetype": results[i].node_type_name,
                        "data-parent_id": results[i].parent,
                        "data-name": results[i].text,
                        "title": (typeof results[i].sig != "undefined") ? node_type + " ::\n " + results[i].sig.toLowerCase() : results[i].node_type_name
                    };
                }
                res.status(200).json(results);
            }
            else {
                return next(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
            }
        });
    }
    else {
        selectNodeId = selectNodeId.substr(3);			// trim "tr-" prefix
        sqlQuery = `select DISTINCT *,(select p.subsystem_name from subsystems p where p.id=$1) from get_node_tree($1,$2,$3) ORDER BY id`;
        return req.corona.query(sqlQuery, [selectRepositoryId, selectNodeId, selectSnapshotId],next)
        .then(results => {
            let newresults = [];
            for (let i = 0, l = results.length; i < l; i++) {

                if (results[i].type == "PROJECT") {
                    results[i].text = "root";
                    results[i].type = "MODULES";
                }

                if (results[i].children == null || results[i].type == "SUBCOMPONENTS") {
                    results[i].children = false;
                }
                if (results[i].parent == null || results[i].isroot == true) {
                    results[i].parent = "#";
                    delete results[i].children;

                } else if (results[i].parent == selectNodeId) {
                    results[i].id = "tr-" + results[i].id;			// add tr prefix
                    results[i].parent = "tr-" + results[i].parent;		// add tr prefix
                    results[i].title = (typeof results[i].text != "undefined") ? results[i].text.toLowerCase() : '';
                    let node_type = (results[i].node_type_name == 'Subsystem') ? 'Repository' : results[i].node_type_name;
                    results[i].a_attr = {
                        "class": "type-" + results[i].type.toLowerCase(),
                        "data-classification": results[i].type,
                        "data-nodetype": results[i].node_type_name,
                        "data-parent_id": results[i].parent,
                        "data-name": results[i].text,
                        "title": (typeof results[i].sig != "undefined") ? node_type + " ::\n " + results[i].sig.toLowerCase() : results[i].node_type_name
                    };
                    newresults.push(results[i]);
                }
            }
            res.status(200).json(newresults);
        });
    }
}