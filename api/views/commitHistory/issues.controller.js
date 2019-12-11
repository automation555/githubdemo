const errors = require('throw.js');
var sqlQuery = '';
export async function getCodeIssues(req, res, next) {
    sqlQuery = `select ci.id issue_id,
                ci.name,
                cio.file_id,
                ci.category as type,
                cio.synopsis,
                cio.line_num as line_number,
                ax.name as module_name,ci.name as rule_key
                from
                code_issues_occurrences cio
                inner join code_issues ci
                on ci.id=cio.code_issue_id
                inner join auxmods ax on ax.id=ci.auxmod_id
                and cio.snapshot_id=$2 and cio.file_id=(select id from nodes n where signature=$3
                and n.subsystem_id=$1 limit 1) order by line_number ASC`;
    req.corona.query(sqlQuery, [req.query.repositoryId, req.query.snapshotId, req.query.filePath])
    .then(data => {
        res.status(200).json(data);
    });
}

export async function getDesignIssues(req, res, next) {
    sqlQuery = `select n.id,ro.id as issue_id,nf.file_id,nf.start_line as first_line_no,nf.end_line as last_line_no,rt.acronym as name,
                n.displayname as method_name,ro.rule_summary as synopsis from
                node_file nf
                inner join rule_occurrences ro
                on nf.component_id=ro.nodeid and nf.snapshot_id=ro.snapshotid
                inner join ruletypes rt
                on rt.id=ro.ruletypeid
                inner join nodes n
                on n.id=nf.component_id
                where nf.kind <> 'V' and nf.snapshot_id=$2 and nf.file_id=(select id from nodes where signature = $3
                and subsystem_id = $1 limit 1) order by first_line_no ASC `;
    req.corona.query(sqlQuery, [req.query.repositoryId, req.query.snapshotId, req.query.filePath])
    .then(data => {
        res.status(200).json(data);
    });
}
