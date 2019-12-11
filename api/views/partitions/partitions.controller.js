import gammaConfig from '../../../core/config';
import * as cf from '../../../utils/common-functions';
import request from 'request';
import * as db from '../../../component/db';

import logger from '../../../utils/logger';
var log = logger.LOG;
var sql_query ;

export async function processBat(req,res,next) {
    sql_query = `select subsystem_uid from subsystems where id=$1`;
    req.corona.query(sql_query, [req.query.subsystems_id],next)
    .then(data=>{
        sql_query = `select subsystems.*,left((right(subsystems.subsystem_language_array::text,
                     length(subsystems.subsystem_language_array::text)-1)),length((right(subsystems.subsystem_language_array::text,
                     length(subsystems.subsystem_language_array::text)-1)))-1) from subsystems,tenant
                     where subsystems.tenant_id=tenant.id and subsystems.subsystem_uid=$1`;

        req.gamma.query(sql_query, [data[0].subsystem_uid],next)
        .then(data1=>{
            db.getCoronaDBSubdomainPool(req.session.tenant_uid, false)
            .then(dbpool=>{
                var connString = `${dbpool.connectionString}&currentSchema=${dbpool.connectionDetails.ANALYTICS_SCHEMA}`;
                //in case of valid certificate remove rejectUnauthorized: false
                request({
                    url: gammaConfig.analysisDBDetails.analysisHost + 'rest/analytics/nodepartitions', //URL to hit
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 300000, // set timeout of 5 mins to get partitions data
                    rejectUnauthorized: false,
                    //Lets post the following key/values as form
                    json: {
                        'subsystem_uid': data[0].subsystem_uid,
                        'subsystem_name': data1[0].subsystem_name,
                        'lang': data1[0].left,
                        'node_id': req.query.node_id,
                        'snapshot_id': req.query.snapshot_id,
                        'percentage_fineness': req.query.percentage_fineness,
                        'connString': cf.encryptStringWithAES(connString)
                    }
                }, function (error, response, body) {
                    if (error) {
                        log.info(`SOMETHING WENT WRONG AT GAMMA SERVICE`);
                        reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));

                    }
                    else if (response.statusCode == 500) {
                        log.info("SOMETHING WENT WRONG AT GAMMA SERVICE");
                        reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));

                    }
                    else if (response.statusCode == 200) {
                        if (body){
                            res.json(body);
                        }
                        else
                            res.json('');
                    }
                    else {
                        log.info(`${response.statusCode} : SOMETHING WENT WRONG AT GAMMA SERVICE`);
                        reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));

                    }
                });
            });

        });
    });
}

// function getPluginName()
// {
//     var pluginName = 'partitions';
//     return pluginName;
// }
