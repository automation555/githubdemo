/**
 * Module dependencies.
 */
import gamma from '../../../core/gamma';
import async from 'async';


var module_details_array = [];

/**
 * Expose methods.
 */
module.exports.moduleDependencies = moduleDependencies;

function moduleDependencies(req,res,next)
{
	var nodeid   = req.query.node_id;
    var snapshotid = req.query.snapshot_id;
    var projectid  = req.query.project_id;
	var node_array = JSON.parse(nodeid).id;
	getModuleDetails(req,res,node_array,snapshotid,next);
}

/** * Get Module details. */

function getModuleDetails(req,res,node_array, snapshotid,next) {
	var connection = gamma.getDBConnection();
	module_details_array = [];
	function executeModuleDetailsQuery(node_id,callback) {
		var sql_module_details = "select n.id as id, n.signature as sig, n.displayname as name, "+
											"round((select avg(rv.rating_value) "+
	    										   "from nodes n, node_types nt, ratings_values rv, ratings r "+
												   "where rv.ratingid = r.id and r.rating = 'overallRating' "+
												   		"and rv.nodeid = n.id and n.nodetype = nt.id "+
												   		"and nt.classification='COMPONENTS' "+
		    											"and n.path like '%" + parseInt(node_id) +
		    											"%' and rv.snapshotid = " + parseInt(snapshotid) + "),2) as rating "+
									"from nodes n where n.id = " + parseInt(node_id);
		connection.query(sql_module_details, function (err, result) {
			if(err)
			{
				console.log(err);
				err.code = 'GAMMA_DB_ERROR';
				return next(err);
			}
			module_details_array.push(result);
			callback.call();
		});
	}


		async.forEach(node_array,executeModuleDetailsQuery, function(err,results) {
			getdependencies(req,res,node_array,snapshotid,next);
		});
}

function getIdFromSignature(sig) {
	for(var k = 0 ; k < module_details_array.length ; k++)
	{
		for(var row =0 ; row< module_details_array[k].rows.length ;row++)
		{
			if(sig.indexOf(module_details_array[k].rows[row].sig) > -1)
			{
				return module_details_array[k].rows[row];
			}
		}
	}
	return 0;
}

/*** Get dependecies. */

function getdependencies(req,res,node_array,snapshotid,next) {
	var final_array = [];
	var connection = gamma.getDBConnection();
	var node_id_str = '';
	try
	{
		if(node_array.length > 0)
		{
			var i = 0;
			for(i; i < node_array.length -1 ; i++)
			{
				node_id_str = node_id_str+'%.'+node_array[i]+'.%|';
			}
			node_id_str = node_id_str+'%.'+node_array[i]+'.%';

			var sql_dependency_details = "select * from get_module_component_dependencies('"+node_id_str+"',"+parseInt(snapshotid)+")";
			connection.query(sql_dependency_details, function (err, result) {
				if(err)
				{
					console.log(err);
					err.code = 'GAMMA_DB_ERROR';
					return next(err);
				}
				else
				{
					try
					{
						var temp_array = [],dependency_object;
						for(var md = 0 ; md < module_details_array.length ; md++)
						{
							var obj ;
							for(var row =0 ; row< module_details_array[md].rows.length ;row++)
							{

								//creating details object for fromnode which is passed is parameter and fetching dep data for that node
								obj = {'id':module_details_array[md].rows[row].id,'name':module_details_array[md].rows[row].name,'sig':module_details_array[md].rows[row].sig,'rating':module_details_array[md].rows[row].rating,'type':'MODULES','dep_out':[]};

								for(var i = 0 ; i < result.rows.length ; i++)
								{
									//intramodule dependencies should not be considered.i.e checking fromnode & tonode doesnot belong to same parent
									if(result.rows[i].fromsig.indexOf(module_details_array[md].rows[row].sig) > -1 && result.rows[i].tosig.indexOf(module_details_array[md].rows[row].sig) <= -1)
									{
										var parent_module = getIdFromSignature(result.rows[i].tosig);
										//fromsig != tosig so either add new dependency details to from node or increment dependency count
										if(parent_module != 0)
										{
											if(temp_array.length != 0)
											{
												for(var k = 0 ; k < temp_array.length ; k++)
												{
													if(temp_array[k].dependency_type == result.rows[i].dependency_type)
													{
														temp_array[k].dependency_count = parseInt(temp_array[k].dependency_count) + 1;
														flag = true;
														break;
													}
												}
												if(!flag)
												{
													dependency_object = {'id':parent_module.id,'name':parent_module.name,'sig':parent_module.sig,'rating':'','type':result.rows[i].tnodetype,'dependency_type':result.rows[i].dependency_type,'dependency_count':1};
													temp_array.push(dependency_object);
													flag = false;
												}
											}
											else
											{
												dependency_object = {'id':parent_module.id,'name':parent_module.name,'sig':parent_module.sig,'rating':'','type':result.rows[i].tnodetype,'dependency_type':result.rows[i].dependency_type,'dependency_count':0};
												temp_array.push(dependency_object);
											}
										}
									}
								}
								break;
							}
							obj.dep_out = temp_array;
							final_array.push(obj);
						}
						res.json(final_array);
					}
					catch(error)
					{
						error.code = 'GAMMA_NODE_ERROR';
						return next(error);
					}
				}
			});
		}
		else
		{
			res.json(final_array);
		}
	}
	catch(err)
	{
		console.log(err);
		err.code = 'GAMMA_NODE_ERROR';
		return next(err);
	}
}
