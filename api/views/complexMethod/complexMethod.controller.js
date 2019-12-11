
import async from 'async';
let sqlQuery;

export async function getData(req,res,next)    
{
    async.parallel({
        complex_method: function (callback) {
            sqlQuery = `select ro.id,ro.snapshotid, ro.nodeid, rt.name, ro.rule_summary, ro.severity, n.signature, n.displayname, n.parentid, np.signature as parent_sig, np.displayname as parent_disp, mc.linescovered, m.value as loc
                        from rule_occurrences ro
                        join ruletypes rt on ro.ruletypeid=rt.id
                        join nodes n on n.id=ro.nodeid
                        join nodes np on n.parentid = np.id
                        join measurements m
                        on (ro.snapshotid = m.snapshotid and ro.nodeid = m.nodeid)
                        left join method_coverage mc
                        on (ro.nodeid = mc.nodeid and ro.snapshotid = mc.snapshotid)
                        where rt.name='TestHungry'
                        and ro.snapshotid = $1
                        and m.measureid = (select id from measures where measurename='LOC')
                        and m.value > 0
                        and np.kind is not null
                        and ((COALESCE( mc.linescovered , 0.01 ))/m.value) < 0.5 order by ro.severity desc offset $2 limit $3`;
            req.corona.query(sqlQuery, [req.query.snapshot_id, req.query.start_index, req.query.count],next)
            .then(data => {
                callback(null, data);
            });
        },
        total_components: function (callback) {
            sqlQuery = `select count(ro.nodeid) as value
                        from rule_occurrences ro
                        join ruletypes rt on ro.ruletypeid=rt.id
                        join nodes n on n.id=ro.nodeid
                        join nodes np on n.parentid = np.id
                        join measurements m
                        on (ro.snapshotid = m.snapshotid and ro.nodeid = m.nodeid)
                        left join method_coverage mc
                        on (ro.nodeid = mc.nodeid and ro.snapshotid = mc.snapshotid)
                        where rt.name='TestHungry'
                        and ro.snapshotid = $1
                        and m.measureid = (select id from measures where measurename='LOC')
                        and m.value > 0
                        and np.kind is not null
                        and ((COALESCE( mc.linescovered , 0.01 ))/m.value) < 0.5 `;
            req.corona.query(sqlQuery, [req.query.snapshot_id],next)
                .then(data => {
                    callback(null, data[0]);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function (err, results) {    
        res.json(results);
    });
}
