
import logger from '../../utils/logger';	
var log = logger.LOG;	
import gamma from '../../core/gamma';	
import fs from 'fs';	

 module.exports.addRoutes = addRoutes;	

 function addRoutes() {	
    gamma.post('/codeissues/codeissuereview', codeIssueReview);	
}	

 function codeIssueReview(req, res, next) {	
    // var lock_file_path = global.rootDir + '/server/services/repository.txt';	
    fs.appendFile('codeIssueReview.csv', req.body.data, (err) => {	
        if (err){ throw err;}	
        log.debug('The "data to append" was appended to file!');	
        res.send('done');	
    });	
}