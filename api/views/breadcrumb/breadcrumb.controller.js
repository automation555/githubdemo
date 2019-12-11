let sqlQuery;

export async function getBreadcrumb(req, res, next) {
    let selectNodeId = (req.query.nodeId == -1) ? null : req.query.nodeId;
    let selectSnapshotId = (req.query.snapshotId == -1) ? null : req.query.snapshotId;
    sqlQuery = `select DISTINCT *,
        (select p.subsystem_name from subsystems p where p.id=$1) 
        from get_node_level($1,$2,$3) 
        ORDER BY id`;

    return req.corona.query(sqlQuery, [req.query.repositoryId, selectNodeId, selectSnapshotId], next)
    .then(data => {
        data.map(d => d.children = appendChildren(data, d.id));
        res.status(200).json(data);
    });
}

function appendChildren(results, parentid) {
    let list = [];
    results.forEach(function (element) {
        if (element.parentid == parentid)
            list.push(element.id);
    }, this);
    return list;
}