
import * as gammaConfig from './../../../core/config';
import _ from 'underscore';

export async function downloadMetrics(req, res, next) {
    var  sqlQuery;
    // Set the headers for the request
    sqlQuery = `select convert_from(content,'UTF-8') from snapshot_contents where snapshotid =$1 and key = 'languagesProcessed';`;
    return req.corona.query(sqlQuery, [req.query.snapshot_id],next)
    .then(data => {
        var languagesResult = (data.length) ? (data[0].convert_from).split(",") : [];
        var activeLanguage = _.map(languagesResult, function (i) {
            return i.toLowerCase();
        });
        var isPartialLanguage = true;

        _.each(activeLanguage, (v, k) => {
            var isPartial = _.contains(gammaConfig.partial_languages, v);
            if (!isPartial)
                isPartialLanguage = false;
        });
        var languageFlag = 'C',
            metricObject = {},
            metricSplitArray = [];
        if (isPartialLanguage)
            languageFlag = 'P';

        sqlQuery = `select * from get_metrics_data($1,$2,$3,$4)`;
        return req.corona.query(sqlQuery, [req.query.node_id, req.query.snapshot_id, req.query.project_id, languageFlag],next)
        .then(metricDetails => {
            var metrics = (metricDetails[0].data).map(d => {
                metricObject = {};
                _.each(d.metrics, (v, k) => {
                    metricSplitArray = v.split(':');
                    metricObject[metricSplitArray[0]] = metricSplitArray[1];
                })
                return ({
                    'Name': d.name,
                    'Signature': d.signature,
                    'Metrics': metricObject
                });
            });
            res.send(JSON.stringify(metrics, null, 4));
        });
    }).catch(function(error){
        next(error);
    });
   
}