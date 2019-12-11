let sqlQuery;
const errors = require('throw.js');

//Get search result
export async function getSearchResults(req, res, next) {
    sqlQuery = `select sub.id as repositoryId,max(snap.id) as snapshot_id,n.id as node_id from subsystems sub
                inner join nodes n
                on sub.id=n.subsystem_id
                inner join snapshots snap
                on snap.subsystem_id=sub.id
                where sub.subsystem_uid=$1
                and n.classification='P'
                and (snap.status='P' or snap.status='K')
                group by n.id,sub.id`;
    return req.corona.query(sqlQuery, [req.params.repositoryUid], next)
    .then(data => {
        // fetching url parameters
        let nodeId = (req.query.nodeId == '') ? 0 : req.query.nodeId;
        sqlQuery = `select * from get_subsystems_by_search($1,$2,$3,$4)`;
        return req.corona.query(sqlQuery, [data[0].repositoryid, req.query.snapshotId, req.query.searchString, nodeId])
        .then(data => {
            if (data.length) {
                res.status(200).json(data);
            }
            else {
                return next(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
            }
        });
    });
}