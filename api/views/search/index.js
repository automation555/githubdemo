import express from 'express';
import permit from './../../../permissions/permission';
import * as searchController from './search.controller';
import { catchError } from './../../../errors/error';

let router = express.Router({ mergeParams: true });

//Search
router.get('/:repositoryUid/search', permit('repositories/:repositoryUid/search'), catchError(searchController.getSearchResults));

module.exports = router;