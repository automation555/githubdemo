import express from 'express';
import * as metadataController from './metadata.controller';
import { catchError } from './../../../errors/error';

let router = express.Router({ mergeParams: true });

//Search
router.get('/getwebsitehost', catchError(metadataController.getWebsiteHost));
router.get('/validateUrl', catchError(metadataController.validateUrl));

module.exports = router;