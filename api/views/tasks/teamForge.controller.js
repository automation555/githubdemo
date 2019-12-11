/**
 * Module dependencies.
 */

import gamma from '../../../core/gamma';
import * as cf from '../../../utils/common-functions';
import logger from '../../../utils/logger';
var log = logger.LOG;
let sql_query;
module.exports.addRoutes = addRoutes;

function addRoutes() {
    gamma.post('/teamforge/getlistofteamforgeprojectassignee', getListOfTeamForgeProjectAssignee);
    gamma.post('/teamforge/getissuetypes', getIssueTypes);
    gamma.post('/teamforge/getallteamforgeprojects', getAllTeamForgeProjects);
    gamma.post('/teamforge/getrepositoriesforselectedproject', getRepositoriesForSelectedProject);
    gamma.post('/teamforge/teamforgedeleteaccount', teamForgeDeleteAccount);
    gamma.post('/teamforge/getteamforgeaccountdetails', getTeamForgeAccountDetails);
    gamma.post('/teamforge/getteamforgeaccountdata', getTeamForgeAccountData);
    gamma.post('/teamforge/teamforgelogin', teamForgeLogin);
    gamma.post('/teamforge/getallartifacts', getAllArtifacts);
    gamma.post('/teamforge/getartifactdetails', getArtifactDetails);
    gamma.post('/teamforge/createteamforgeissue', createTeamForgeIssue);
}

function getTeamForgeAccountDetails(req, res) {
    sql_query = `select * from teamforge_details where repository_uid = $1 and tenant_id =$2`;
    req.gamma.query(sql_query, [req.body.repository_uid, req.session.tenant_id])
        .then(data => {
            if (data.length > 0) {
                data[0].username = (data[0].username == '') ? '' : cf.encryptURL(cf.decryptStringWithAES(data[0].username));
                data[0].password = (data[0].password == '') ? '' : cf.encryptURL(cf.decryptStringWithAES(data[0].password));
            }
            res.send(data);
        });
}

function getTeamForgeAccountData(req, res) {
    sql_query = `select * from teamforge_details where repository_uid = $1 and tenant_id =$2`;
    req.gamma.query(sql_query, [req.body.repository_uid, req.session.tenant_id])
        .then(data => {
            if (data.length > 0) {
                data[0].username = (data[0].username == '') ? '' : cf.encryptURL(cf.decryptStringWithAES(data[0].username));
                data[0].password = (data[0].password == '') ? '' : cf.encryptURL(cf.decryptStringWithAES(data[0].password));
            }
            res.send(data);
        });
}

function teamForgeDeleteAccount(req, res) {
    sql_query = `delete from teamforge_details where repository_uid = $1 and tenant_id =$2`;
    req.gamma.query(sql_query, [req.body.repository_uid, req.session.tenant_id])
        .then(data => {
            res.send(data);
        });
}

function teamForgeLogin(req, res) {

    var username = (req.body.username == '') ? '' : cf.encryptStringWithAES(cf.decryptURL(req.body.username));
    var password = (req.body.password == '') ? '' : cf.encryptStringWithAES(cf.decryptURL(req.body.password));
    var host_url = req.body.host_url;

    var spawn = require('child_process').spawn;
    log.debug("1. Executing curl command for getting access token");
    var access_token = spawn('bash module_features/init_get_access_token.sh', [
        host_url, username, password
    ], {
            shell: true
        });

    var stdout = "";
    access_token.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    access_token.stdout.on('end', () => {
        log.debug("========= Got Access Token Response ======");
        log.debug(stdout);
        try {
            var stdout1 = JSON.parse(stdout);
            if (stdout1.access_token.length > 0) {
                addDetailsInDB(req, res, host_url, username, password);
            } else {
                log.debug('Access token not found.');
            }
        } catch (error) {
            log.debug("There was some error in parsing token JSON");
            res.send(500, { status: 'error', message: 'Incorrect response' });
        }
    });
    var stderr = "";
    access_token.stderr.on('data', (data) => {
        stderr += data.toString();
        log.debug(stderr);
    });

    access_token.on('close', () => {
        // callback(stdout, stderr)
        //log.debug('Callback - access token');
    });
}

function addDetailsInDB(req, res, host_url, username, password) {

    var repository_uid = req.body.repository_uid;
    var repository_name = req.body.repository_name;
    var repository_id = req.body.repository_id;
    var project_id = req.body.project_id;

    sql_query = `select count(*) from teamforge_details where repository_uid = $1`;
    req.gamma.query(sql_query, [repository_uid])
        .then(data => {
            if (data[0].count == 1) {
                sql_query = `update teamforge_details set username=$1,password=$2,host_url=$3,teamforge_project_id=$4,repository_name=$5,repository_id=$6 where repository_uid=$7`;
                req.gamma.query(sql_query, [username, password, host_url, project_id, repository_name, repository_id, repository_uid])
                    .then(() => {
                        res.send(200, { status: 'success', message: 'TeamForge account updated successfully!!', details: 'TeamForge account updated successfully.' });
                    });
            }
            else {
                sql_query = `insert into teamforge_details(username,password,host_url,teamforge_project_id,repository_uid, repository_id,repository_name,user_id,tenant_id)values($1,$2,$3,$4,$5,$6,$7,$8,$9)`;
                req.gamma.query(sql_query, [username, password, host_url, project_id, repository_uid, repository_id, repository_name, req.session.user_id, req.session.tenant_id])
                    .then(() => {
                        res.send(200, { status: 'success', message: 'Account added successfully!!' });
                    });
            }
        });
}

function getAllArtifacts(req, res) {

    var username = (req.body.username == '') ? '' : cf.decryptStringWithAES(req.body.username);
    var password = (req.body.password == '') ? '' : cf.decryptStringWithAES(req.body.password);
    var host_url = req.body.host_url;

    var spawn = require('child_process').spawn;
    var access_token = spawn('bash module_features/init_get_access_token.sh', [
        host_url, username, password
    ], {
            shell: true
        });

    var stdout = "";
    access_token.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    access_token.stdout.on('end', () => {
        log.debug("========= Got Access Token Response ======");
        log.debug(stdout);
        try {
            var stdout1 = JSON.parse(stdout);
            if (stdout1.access_token) {
                getArtifacts(req, res, stdout1.access_token, host_url);
            } else
                log.debug('Access token not found.');
        } catch (error) {
            log.debug("There was some error in parsing token JSON");
            res.send(500, { status: 'error', message: 'Incorrect response' });
        }
    });

    var stderr = "";
    access_token.stderr.on('data', (data) => {
        stderr += data.toString();
        log.debug(stderr);
    });

    // access_token.on('close', (code) => {
    //     // callback(stdout, stderr)
    //     //log.debug('Callback - access token');
    // });
}

function getArtifacts(req, res, access_token, host_url) {

    var project_id = req.body.project_id;

    var spawn = require('child_process').spawn;
    log.debug("2. Executing curl command for getting all artifacts");

    var artifacts_data = spawn('bash module_features/init_get_all_artifacts.sh', [
        host_url, access_token, project_id
    ], {
            shell: true
        });

    var stdout = "";
    artifacts_data.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    artifacts_data.stdout.on('end', () => {
        log.debug(stdout);
        log.debug("========= Got all artifacts response ======");
        try {
            var artifact_array = JSON.parse(stdout);
            if (artifact_array != null || artifact_array != undefined) {
                res.send(200, { status: 'success', message: artifact_array });
            } else {
                log.debug('Artifact list not found.');
                res.send(400, { status: 'error', message: 'In else :: somthing went wrong' });
            }
        } catch (error) {
            log.debug("There was some error in parsing artifacts JSON");
            res.send(400, { status: 'error', message: 'somthing went wrong' });
        }
    });

    var stderr = "";
    artifacts_data.stderr.on('data', (data) => {
        stderr += data.toString();
        log.debug(stderr);
    });

    // artifacts_data.on('close', (code) => {
    //     // callback(stdout, stderr)
    //     // log.debug('Callback - all artifacts');
    // });
}

function getAllTeamForgeProjects(req, res) {
    sql_query = `select * from teamforge_details where tenant_id =$1`;
    req.gamma.query(sql_query, [req.session.tenant_id])
        .then(data => {
            res.send(data);
        });
}

function getRepositoriesForSelectedProject(req, res) {
    sql_query = `select * from teamforge_details where teamforge_project_id = $1 and tenant_id =$2`;
    req.gamma.query(sql_query, [req.body.project_id, req.session.tenant_id])
        .then(data => {
            res.send(data);
        });
}

function getArtifactDetails(req, res) {

    var username = (req.body.username == '') ? '' : cf.decryptStringWithAES(req.body.username);
    var password = (req.body.password == '') ? '' : cf.decryptStringWithAES(req.body.password);
    var host_url = req.body.host_url;

    var spawn = require('child_process').spawn;
    var access_token = spawn('bash module_features/init_get_access_token.sh', [
        host_url, username, password
    ], {
            shell: true
        });

    var stdout = "";
    access_token.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    access_token.stdout.on('end', () => {
        log.debug("========= Got Access Token Response ======");
        log.debug(stdout);
        try {
            var stdout1 = JSON.parse(stdout);
            if (stdout1.access_token) {
                getSelectedArtifactDetails(req, res, stdout1.access_token, host_url);
            } else {
                log.debug('Access token not found.');
            }
        } catch (error) {
            log.debug("There was some error in parsing token JSON");
            res.send(500, { status: 'error', message: 'Incorrect response' });
        }
    });

    var stderr = "";
    access_token.stderr.on('data', (data) => {
        stderr += data.toString();
        log.debug(stderr);
    });

    access_token.on('close', () => {
        // callback(stdout, stderr)
        //log.debug('Callback - access token');
    });
}

function getSelectedArtifactDetails(req, res, access_token, host_url) {

    var artifact_id = req.body.artifact_id;

    var spawn = require('child_process').spawn;
    log.debug("3. Executing curl command for getting artifact details");

    var artifacts_data = spawn('bash module_features/init_get_artifact_details.sh', [
        host_url, access_token, artifact_id
    ], {
            shell: true
        });

    var stdout = "";
    artifacts_data.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    artifacts_data.stdout.on('end', () => {
        log.debug("========= Got artifact details response ======");
        log.debug(stdout);

        try {
            var artifact_array = JSON.parse(stdout);
            if (artifact_array != null || artifact_array != undefined) {
                res.send(200, { status: 'success', message: artifact_array });
            } else {
                log.debug('Artifact details not found.');
                res.send(400, { status: 'error', message: 'somthing went wrong' });
            }
        } catch (error) {
            log.debug("There was some error in parsing artifacts JSON");
            res.send(400, { status: 'error', message: 'somthing went wrong' });
        }
    });

    var stderr = "";
    artifacts_data.stderr.on('data', (data) => {
        stderr += data.toString();
        log.debug(stderr);
    });

    artifacts_data.on('close', () => {
        // callback(stdout, stderr)
        // log.debug('Callback - all artifacts');
    });
}

function createTeamForgeIssue(req, res) {

    var username = (req.body.username == '') ? '' : cf.decryptStringWithAES(req.body.username);
    var password = (req.body.password == '') ? '' : cf.decryptStringWithAES(req.body.password);
    var host_url = req.body.host_url;

    var spawn = require('child_process').spawn;
    var access_token = spawn('bash module_features/init_get_access_token.sh', [
        host_url, username, password
    ], {
            shell: true
        });

    var stdout = "";
    access_token.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    access_token.stdout.on('end', () => {
        log.debug("========= Got Access Token Response ======");
        log.debug(stdout);
        try {
            var stdout1 = JSON.parse(stdout);
            if (stdout1.access_token) {
                creatingTeamForgeTask(req, res, stdout1.access_token, host_url);
            } else {
                log.debug('Access token not found.');
            }
        } catch (error) {
            log.debug("There was some error in parsing token JSON");
            res.send(500, { status: 'error', message: 'Incorrect response' });
        }
    });

    var stderr = "";
    access_token.stderr.on('data', (data) => {
        stderr += data.toString();
        log.debug(stderr);
    });

    access_token.on('close', () => {
        // callback(stdout, stderr)
        //log.debug('Callback - access token');
    });
}

function creatingTeamForgeTask(req, res, access_token, host_url) {

    var project_id = req.body.project_id;
    var task_title = req.body.title;
    var task_description = req.body.description;
    var category = req.body.category;
    var priority = req.body.priority;
    var assignedTo = req.body.assignee;

    var spawn = require('child_process').spawn;
    log.debug("4. Executing curl command for creating artifact.");

    var artifacts_data = spawn('bash module_features/init_create_task.sh', [
        host_url, access_token, project_id, task_title, task_description, category, priority, assignedTo
    ], {
            shell: true
        });

    var stdout = "";
    artifacts_data.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    artifacts_data.stdout.on('end', () => {
        log.debug("========= Got create artifact response ======");
        log.debug(stdout);
        try {
            var artifact_array = JSON.parse(stdout);
            if (artifact_array != null || artifact_array != undefined) {
                res.send(200, { status: 'success', message: artifact_array });
            } else {
                log.debug('Artifact not created.');
                res.send(400, { status: 'error', message: 'somthing went wrong' });
            }
        } catch (error) {
            log.debug("There was some error in parsing artifacts JSON");
        }
    });

    var stderr = "";
    artifacts_data.stderr.on('data', (data) => {
        stderr += data.toString();
        log.debug(stderr);
    });

    // artifacts_data.on('close', (code) => {
    //     // callback(stdout, stderr)
    //     // log.debug('Callback - all artifacts');
    // });
}




function getListOfTeamForgeProjectAssignee() {
    res.send('Done');
}

function getIssueTypes() {
    res.send('Done');
}


/*
CREATE TABLE IF NOT EXISTS teamforge_details
(
    id serial primary key,
    username character varying,
    password character varying,
    host_url character varying,
    teamforge_project_id character varying,
    repository_id bigint,
    repository_uid character varying,
    repository_name character varying,
    project_name character varying,
    user_id character varying,
    tenant_id character varying
);
*/

/*
    {
        "access_token": "eyJraWQiOiIxIiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiJhZG1pbiIsImF1ZCI...",
        "token_type": "Bearer"
    }
*/

