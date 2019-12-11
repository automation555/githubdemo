
import * as cf from '../../../utils/common-functions';
import async from 'async';
import _ from 'underscore';
import { getCodeIssuesTagsKpis } from './../../v1/repository/codeIssues/codeIssues.services';
const errors = require('throw.js');

export async function getFileSummaryDetails(req, res, next) {
    var fileSummaryDetails = {
        'files': [],
        'code_issues': [],
        'antipatterns': []
    };
    async.parallel({
        files_details: function (callback) {
            let sqlQuery = `select nds.id as id, min(nf.start_line), max(nf.end_line),
                        nds.displayname as name,get_language_name_by_id(nds.language_id) as language,nds.signature as sig
                        from nodes as nds LEFT JOIN node_file as nf
                        on nds.id = nf.file_id
                        INNER JOIN nodes_snapshots ns
                        on nds.id = ns.nodeid and ns.snapshotid = $2
                        where nds.id=$3
                        and nds.subsystem_id=$1
                        group by nds.id, nds.displayname, nds.language_id, nds.signature`;
            //sql_query = `select * from get_component_file_details($1,$2,$3)`;
            req.corona.query(sqlQuery, [req.query.project_id, req.query.snapshot_id, req.query.node_id],next)
                .then(data => {
                    callback(null, data);
                });
        },
        file_metric_details: function (callback) {
            let sqlQuery = `select * from get_file_metric_data($1, $2, $3)`;
            req.corona.query(sqlQuery, [req.query.node_id, req.query.project_id, req.query.snapshot_id],next)
                .then(data => {
                    callback(null, data);
                });
        },
        code_issues_details: function(callback) {
            let sqlQuery = `select cio.id issue_id,
                        ci.name,
                        cio.file_id,
                        ci.category as type,
                        cio.synopsis,
                        cio.line_num as line_number,
                        cio.is_suppress,
                        cio.suppression_id,
                        ci.id as code_issue_id,
                        ax.name as module_name,ci.name as rule_key
                        from
                        code_issues_occurrences cio
                        inner join code_issues ci
                        on ci.id=cio.code_issue_id
                        inner join auxmods ax on ax.id=ci.auxmod_id
                        and cio.snapshot_id=$1 and cio.file_id=$2`;
            req.corona.query(sqlQuery,[req.query.snapshot_id, req.query.node_id],next)
            .then(data=>{
                callback(null, data);
            });
        },
        antipattern_details: function(callback) {
            let sqlQuery = `select n.id,ro.id as issue_id,nf.file_id,nf.start_line as first_line_no,nf.end_line as last_line_no,rt.acronym as name,
                        n.displayname as method_name,ro.rule_summary as synopsis from
                        node_file nf
                        inner join rule_occurrences ro
                        on nf.component_id=ro.nodeid and nf.snapshot_id=ro.snapshotid
                        inner join ruletypes rt
                        on rt.id=ro.ruletypeid
                        inner join nodes n
                        on n.id=nf.component_id
                        where nf.kind <> 'V' and nf.snapshot_id=$1 and nf.file_id=$2`;
            req.corona.query(sqlQuery, [req.query.snapshot_id, req.query.node_id],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    function(err,results) {

            if (results.files_details != null && results.files_details.length > 0) {
                var file_method_metrics = (results.file_metric_details).filter(d => d.file_id == results.files_details[0].id);
                _.extend(results.files_details[0], { 'file_path': cf.replace_slash(results.files_details[0].sig), 'file_method_metrics': file_method_metrics});
                fileSummaryDetails.files.push(results.files_details[0]);
            }

            if (results.code_issues_details.length > 0 && results.code_issues_details != null) {
                results.code_issues_details.forEach(code_issue => {
                    code_issue.formed_issue_id = "CI" + code_issue.issue_id;
                    code_issue.issue_id = code_issue.issue_id;
                    fileSummaryDetails.code_issues.push(code_issue);
                });
            }

            if (results.antipattern_details != null && results.antipattern_details.length > 0) {
                results.antipattern_details.forEach(antipattern => {
                    antipattern.formed_issue_id = "DI" + antipattern.issue_id;
                    fileSummaryDetails.antipatterns.push(antipattern);
                });
            }

            if (fileSummaryDetails.code_issues.length) {
                getCodeIssuesTagsKpis(req, fileSummaryDetails.code_issues, next)
                .then(codeIssues=>{
                    fileSummaryDetails.code_issues = codeIssues;
                    res.json(fileSummaryDetails);
                })
                .catch(error=>{
                    return next(new errors.InternalServerError(error.message, 1018));
                });
            }
            else {
                res.json(fileSummaryDetails);
            }
    });
}