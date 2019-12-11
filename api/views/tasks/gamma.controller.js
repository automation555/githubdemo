/**
 * Module dependencies.
 */
import async from 'async';
import * as cf from '../../../utils/common-functions';
import emailSender from '../../../component/email';
import _ from 'underscore';


/**
 * Expose methods.
 */
var sql_query = '';

export function getRepositoryType(req, res, next) {
    var getRepositoryTypeSqlQuery = `select type_name from master_repository_types where id = (
        select subsystem_repository_type from subsystems where subsystem_uid = $1);`;
    req.gamma.query(getRepositoryTypeSqlQuery, [req.query.uid])
        .then(data => {
            res.json(data);
        });
}

//function returns the list of task criticality, status, type, assigner and assignee details
export function getTasksMetadata(req,res,next){
    async.parallel({
        type_details: function (callback) {
            sql_query = `select task_type_id as id, task_type_name as name from task_type`;
            req.gamma.query(sql_query, [])
                .then(data => {
                    callback(null, data);
                });
        },
        criticality_details: function (callback) {
            sql_query = `select task_criticality_id as id, task_criticality_name as name from task_criticality`;
            req.gamma.query(sql_query, [])
                .then(data => {
                    callback(null, data);
                });
        },
        status_details: function (callback) {
            sql_query = `select task_status_id as id, task_status_name as name from task_status`;
            req.gamma.query(sql_query, [])
                .then(data => {
                    callback(null, data);
                });
        },
        assignee_details: function (callback) {
            // sql_query = `select u.id as id,u.first_name ||' '||u.last_name as name from users u join user_project us on u.id = us.user_id where u.status=1 and project_id=$1 and u.tenant_id=$2`;
            sql_query = `select u.id as id,u.first_name||' '||u.last_name as name
                         from users u inner join user_project up on u.id=up.user_id where u.status= 1
                         and up.project_id=$1 and u.tenant_id=$2 union select u.id as id, u.first_name||' '||u.last_name as name
                         from users u inner join  users_role ur on u.id=ur.user_id inner join role r on ur.role_id=r.id
                         where (r.name ='Account administrator' or r.name ='Project administrator') and u.tenant_id=$2`;
            req.gamma.query(sql_query, [req.query.project_id, req.session.tenant_id])
                .then(data => {
                    callback(null, data);
                });
        },
        assigner_details: function (callback) {
            sql_query = `select u.id as id, u.first_name||' '||u.last_name as name from task t inner join users u on t.task_creator = u.id where t.tenant_id = $1 group by u.first_name, u.last_name, u.id`;
            req.gamma.query(sql_query, [req.session.tenant_id])
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
        if (err)
        {
            err.code = 'GAMMA_DB_ERROR';
            return next(err);
        }
        else
        {
            var final_object = {
                'criticality':results.criticality_details,
                'type':results.type_details,
                'status':results.status_details,
                'assignee': results.assignee_details,
                'assigner': results.assigner_details
            };
            res.json(final_object);
        }
    });
}

export function getTasksList(req, res, next) {

    var nodeWhere = '';
    sql_query = `select * from get_tenantwise_tasks($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`;
    req.gamma.query(sql_query, [req.session.tenant_id,
                                req.query.node_id,
                                req.query.search_string,
                                req.query.criticality,
                                req.query.type,
                                req.query.status,
                                req.query.assigner,
                                req.query.assignee,
                                req.query.start_index,
                                req.query.stop_index])
    .then(data => {
        sql_query = `select * from get_tenantwise_tasks_total_cnt($1,$2,$3,$4,$5,$6,$7,$8)`;
        req.gamma.query(sql_query, [req.session.tenant_id,
                                    req.query.node_id,
                                    req.query.search_string,
                                    req.query.criticality,
                                    req.query.type,
                                    req.query.status,
                                    req.query.assigner,
                                    req.query.assignee])
        .then(data_count => {
            var tasksData = {
                'data': data,
                'total_count': data_count[0].total_cnt
            };
            res.json(tasksData);
        });
    });
}

function getTaskDetails(req, res, next) {
    sql_query = `select task.task_id,task.task_caption as task_name,task.subsystem_uid,task.task_description,task.task_creation_date,task.task_due_date,formed_task_id,
                task.node_signature,task.node_id,task.project_id,task.issue_id,
                task_status.task_status_name as status,task_type.task_type_name as task_type,task_criticality.task_criticality_name as
                criticality, task.task_creator,u1.first_name||' '||u1.last_name as asigner_name,u1.image ,task.task_asignee ,u2.first_name||' '||u2.last_name as asignee_name ,u2.image
                from task
                join task_type on task.task_type_id=task_type.task_type_id
                join task_criticality on task.task_criticality=task_criticality.task_criticality_id
                join task_status on task.task_status=task_status.task_status_id
                left join users u1 on task.task_creator=u1.id
                left join users u2 on task.task_asignee=u2.id
                where task.task_id=$1`;
    req.gamma.query(sql_query, [req.query.task_id])
        .then(data => {
            if (data[0]) {
                sql_query = `select * from (select id from subsystems where subsystem_uid = $1) s1
                                cross join (select displayname from nodes where id = $2) s2`
                req.corona.query(sql_query, [data[0].subsystem_uid, data[0].node_id])
                    .then(data1 => {
                        if (data1.length) {
                            data[0].subsystem_id = data1[0].id;
                            data[0].node_name = data1[0].displayname;
                        }
                        res.json(data);
                    });
            }
            else {
                res.json([]);
            }
        });
}

function deleteTask(req, res, next) {
    sql_query = `select * from (select email as task_asignee,first_name as task_asignee_name from users where id = (select task_asignee from task where task_id = $1)) u1
                    cross join (select email as task_asigner from users where id = (select task_creator from task where task_id = $1)) u2
                    cross join (select first_name,last_name from users where id = $2) u3
                    cross join (select formed_task_id,task_caption,task_description,task_asignee as assignee_id,task_creator as creator_id from task
                    where task_id = $1) t`;
    req.gamma.query(sql_query, [req.query.task_id, req.session.user_id])
    .then(task_result => {
        var status_email_array = [];
        if (task_result.length) {
            if (task_result[0].assignee_id == req.session.user_id)
                status_email_array.push(task_result[0].task_asigner);
            else if (task_result[0].creator_id == req.session.user_id)
                status_email_array.push(task_result[0].task_asignee);
            else {
                status_email_array.push(task_result[0].task_asigner);
                status_email_array.push(task_result[0].task_asignee);
            }
            var assigner = `${task_result[0].first_name}  ${task_result[0].last_name}`;
            var formed_task_id = task_result[0].formed_task_id;
            var task_title = task_result[0].task_caption;
            var task_description = task_result[0].task_description;
            var first_name = task_result[0].task_asignee_name;
        }
        sql_query = `delete from task where task_id = $1`;
        req.gamma.query(sql_query, [req.query.task_id])
            .then(data => {
                for (var i = 0; i < status_email_array.length; i+=1) {
                    cf.getDomainURL(req.session.tenant_id, "id").then(function (domainURL) {
                        var task_link = domainURL + '?redirect=' + req.body.task_hash;
                        emailSender.sendMail('task', {
                            'subject': `[EMBOLD] (${formed_task_id}) ${task_title}`,
                            'email': status_email_array[0],
                            'user_name': first_name,
                            'base_url': domainURL,
                            'email_type': "task-mail",
                            'assigner': assigner,
                            'task_email_type': 'Task Deleted',
                            'task_detail_inline': 'A task has been deleted:',
                            'task_id': formed_task_id,
                            'task_title': task_title,
                            'task_description': task_description,
                            'task_status': 'deleted',
                            'gamma_url': task_link,
                            'task_image': 'task_deleted',
                            'image_url': domainURL,
                            'web_url': cf.getWebSiteURL()
                        });
                        res.send(200, { status: 'success', message: 'Task deleted successfully.', details: 'Task deleted successfully.' });
                    });
                }
            });
    });
}

function addTask(req, res, next) {
    var issue_title, task_description, task_type, priority, assignee, node_id, subsystem_id, project_id, project_code, due_date, linked_issue_id;
    try {
        issue_title = cf.parseString(req.body.issue_title);
        task_description = cf.parseString(req.body.task_desc);
        task_type = req.body.task_type;
        priority = req.body.priority;
        assignee = ((req.body.assignee === undefined) ? req.session.user_id : req.body.assignee);
        node_id = req.body.node_id;
        subsystem_id = req.body.subsystem_id;
        project_id = req.body.project_id;
        project_code = req.body.project_code;
        due_date = ((req.body.due_date === undefined) ? '' : req.body.due_date);
        linked_issue_id = ((req.body.linked_issue_id === undefined) ? '' : req.body.linked_issue_id);
    }
    catch (err) {
        err.code = 'GAMMA_REQUEST_ERROR';
        return next(err);
    }
    sql_query = `select * from
                         (select subsystem_uid,subsystem_name from subsystems where id=$1) t1 cross join
                         (select path,signature from nodes where id = $2) t2`;

    req.corona.query(sql_query, [subsystem_id, node_id])
        .then(data => {
            var project_count_query = `select max(substring (formed_task_id from position ('-' in formed_task_id) + 1 for length(formed_task_id)) :: integer) as count from task where project_id = $1`;
            req.gamma.query(project_count_query, [project_id])
                .then(result => {
                    project_code = project_code + '-' + (result[0].count != null ? (parseInt(result[0].count) + 1) : 1);
                    var task_insert_query = `insert into task
                (task_caption,task_description,task_type_id,task_criticality,task_creator,task_creation_date,task_due_date,issue_id,
                    subsystem_uid,node_id,task_status,task_asignee,formed_task_id,node_path,node_signature,project_id, task_updated_date, tenant_id)
                values
                ($1,$2,$3,$4,$5,now(),$6,$7,
                $8,$9,1,$10,$11,$12,$13,$14,now(),$15) returning task_id`;

                    req.gamma.query(task_insert_query, [issue_title, task_description, task_type, priority, req.session.user_id, due_date, linked_issue_id, data[0].subsystem_uid, node_id, assignee, project_code, data[0].path, data[0].signature, project_id,req.session.tenant_id])
                        .then(insert_data => {
                            res.send(200, { status: 'success', message: 'Task created successfully.', details: 'Task created successfully.', task_id: insert_data[0].task_id, assignee_id: assignee });
                        });
                });
        });
}

function sendTaskCreationMail(req, res, next) {
    var assignee_id = (req.body.assignee_id != 'null') ? req.body.assignee_id : req.session.user_id;
    sql_query = `select * from (select email,first_name from users where id = $1) u1
                    cross join (select first_name as assigner_first_name,last_name from users as assigner where id = $2) u2
                    cross join (select formed_task_id,task_caption,task_description from task where task_id = $3) t`;

    req.gamma.query(sql_query, [assignee_id, req.session.user_id, req.body.task_id])
        .then(task_result => {
            var email = task_result[0].email;
            var assigner = `${task_result[0].assigner_first_name} ${task_result[0].last_name}`;
            var formed_task_id = task_result[0].formed_task_id;
            var task_title = task_result[0].task_caption;
            var task_description = task_result[0].task_description;
            var first_name = task_result[0].first_name;
            cf.getDomainURL(req.session.tenant_id, "id").then(function (domainURL) {
                var task_link = domainURL + '?redirect=' + req.body.task_hash;
                emailSender.sendMail('tasks', {
                    'subject': `[EMBOLD] (${formed_task_id}) ${task_title}`,
                    'email': email,
                    'assigner': assigner,
                    'user_name': first_name,
                    'base_url': domainURL,
                    'email_type': "task-mail",
                    'task_email_type': 'New Task Added',
                    'task_detail_inline': 'A new task has been assigned to you:',
                    'task_id': formed_task_id,
                    'task_title': task_title,
                    'task_description': task_description,
                    'gamma_url': task_link,
                    'task_image': 'task_added',
                    'web_url': cf.getWebSiteURL(),
                    'image_url': domainURL
                });
                res.send(200, { status: 'success', message: 'Task created successfully.', details: 'Task created successfully.' });
            });
        });
}

function editTask(req,res,next) {
    var issue_title, task_description, task_hash, issue_id, criticality_id, assignee_id,
        subsystem_id, project_id, node_id, task_id, status_id, linked_issue_id, due_date;
    try
    {
        issue_title         = cf.parseString(req.body.issue_title);
        task_description    = cf.parseString(req.body.task_desc);
        issue_id            = req.body.task_type;
        criticality_id      = req.body.priority;
        assignee_id         = (req.body.assignee != 'null')?req.body.assignee:req.session.user_id;
        node_id             = req.body.node_id;
        status_id           = req.body.status;
        subsystem_id        = req.body.subsystem_id;
        project_id          = req.body.project_id;
        due_date            = req.body.due_date;
        linked_issue_id     = req.body.linked_issue_id;
        task_id             = req.body.task_id;
        task_hash           = req.body.task_hash;
        if(linked_issue_id == undefined)
            linked_issue_id = "";

    }
    catch(err)
    {
        err.code = 'GAMMA_REQUEST_ERROR';
        return next(err);
    }

    sql_query = `select * from
                         (select subsystem_uid,subsystem_name from subsystems where id=$1) t1 cross join
                         (select path,signature from nodes where id = $2) t2`;

    req.corona.query(sql_query, [subsystem_id, node_id])
        .then(data =>{
            sql_query = `update task set
                        task_caption = $1, task_description = $2,
                        task_type_id = $3, task_criticality = $4, task_status = $5,
                        task_asignee = $6, task_due_date = $7, subsystem_uid = $8,
                        node_id = $9, project_id = $10, node_path = $11, node_signature = $12,
                        issue_id = $13, task_updated_date = now() where task_id = $14`;

            req.gamma.query(sql_query, [issue_title, task_description, issue_id, criticality_id, status_id, assignee_id, due_date, data[0].subsystem_uid, node_id, project_id, data[0].path, data[0].signature, linked_issue_id, task_id])
                .then(result => {
                    sendMailInLoop(req, res, next, 'status_change', 'updated', 'Task Updated successfully.');
                });
        });
}

function getComments(req,res,next) {
    sql_query = `select comments.comment_description,comments.comment_date,
                comments.comment_by,users.first_name||' '||users.last_name as commentor,users.image from comments,
                users where task_id=$1 and comments.comment_by=users.id`;
    req.gamma.query(sql_query,[req.query.task_id])
    .then(data=>{
        res.json(data);
    });
}

function addComment(req,res,next) {
    sql_query = `insert into comments(comment_description,comment_date,comment_by,task_id)
                    values($1,now(),${req.session.user_id},$2)`;
    req.gamma.query(sql_query, [cf.parseString(req.body.comment_text),req.body.task_id])
    .then(data=>{
        var update_query = `
            update task set task_updated_date = now() where task_id = $1;
        `;

        req.gamma.query(update_query, [req.body.task_id])
        .then(data=> {
            sendMailInLoop(req, res, next, 'commentor', '', 'Comment added successfully.');
        });
    });
}

function resolveIssue(req,res,next) {
    sql_query = `update task set task_status = $1, task_updated_date = now() where task_id = $2`;
    req.gamma.query(sql_query, [req.body.status, req.body.task_id])
        .then(data => {
            sendMailInLoop(req, res, next, 'status_change', '','Task status updated successfully.');
        });
}

function sendMailInLoop(req, res, next, email_type, current_status, response_message) {
    var task_status = current_status;

    var task_status_query = ` cross join (select task_status_name from task_status where task_status_id = $3) ts`;
    sql_query = `select * from (select email as task_asignee, first_name as task_asignee_name from users where id = (select task_asignee from task where task_id = $1)) u1
                            cross join (select email as task_asigner from users where id = (select task_creator from task where task_id = $1)) u2
                            cross join (select first_name,last_name from users where id = $2) u3
                            cross join (select formed_task_id,task_caption,task_description,task_asignee as assignee_id,task_creator as creator_id
                            from task where task_id = $1) t`;
    var params = [req.body.task_id, req.session.user_id];
    if (email_type == 'status_change' && req.body.status)
    {
        sql_query   = `${sql_query}${task_status_query}`;
        params      = [req.body.task_id, req.session.user_id, req.body.status]
    }
    req.gamma.query(sql_query, params)
        .then(task_result => {
            var email_array = [];
            if (task_result.length > 0) {
                if (task_result[0].assignee == req.session.user_id)
                    email_array.push(task_result[0].task_asigner);
                else if (task_result[0].creator_id == req.session.user_id)
                    email_array.push(task_result[0].task_asignee);
                else {
                    email_array.push(task_result[0].task_asigner);
                    email_array.push(task_result[0].task_asignee);
                }
                var assigner = `${task_result[0].first_name}  ${task_result[0].last_name}`;
                var formed_task_id = task_result[0].formed_task_id;
                var task_title = task_result[0].task_caption;
                var task_description = task_result[0].task_description;
                var first_name = task_result[0].task_asignee_name;
                var task_image ="task_status_changed";
                var task_detail_inline = 'A task status has been changed:';
                if (email_type === 'status_change' && current_status === 'updated') {
                    task_detail_inline = 'A task has been updated';
                }
                if (email_type == 'status_change' && current_status === ''){
                    task_status = ((task_result[0].task_status_name).toLowerCase() == 'ready_to_test') ? 'fixed' : task_result[0].task_status_name;
                }
                if (email_type == 'commentor' && current_status === ''){
                    task_status = "New Comment";
                    task_detail_inline = 'A new comment on task:';
                    task_description = req.body.comment_text;
                    task_image ="Ticket_Comment";
                }
                function sendMailToUser(email_element, callback)
                {
                    cf.getDomainURL(req.session.tenant_id,"id").then(function (domainURL) {
                        var task_link = domainURL +'?redirect=' + req.body.task_hash;
                        emailSender.sendMail('tasks', {
                            'subject': `[EMBOLD] (${formed_task_id}) ${task_title}`,
                            'email': email_element,
                            'assigner': assigner,
                            'user_name': first_name,
                            'base_url': domainURL,
                            'email_type': "task-mail",
                            'task_email_type': "Task " + task_status,
                            'task_detail_inline': task_detail_inline,
                            'task_id': formed_task_id,
                            'task_title': task_title,
                            'task_description': task_description,
                            'task_status': task_status,
                            'gamma_url': task_link,
                            'task_image':task_image,
                            'web_url': cf.getWebSiteURL(),
                            'image_url':domainURL
                        });
                        callback.call();
                    });
                }

                async.forEach(email_array,sendMailToUser,function(error, result) {
                    if(error) {
                        error.code = 'GAMMA_NODE_ERROR';
                        return next(error);
                    }
                    else{
                        res.send(200, { status: 'success', message: response_message, details: response_message, response: assigner });
                    }
                });

            } else {
                res.send(200, { status: 'success', message: response_message, details: response_message, response: assigner });
            }
        });
}

