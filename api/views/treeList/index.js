
import express from 'express';
import permit from './../../../permissions/permission';
import * as treeListController from './treeList.controller';
import { catchError } from './../../../errors/error';

let router = express.Router({ mergeParams: true });

//Tree
router.get('/:repositoryUid/tree/subcomponents', permit('repositories/:repositoryUid/tree/subcomponents'), catchError(treeListController.getSubcomponentData));
router.get('/:repositoryUid/tree/nodepath', permit('repositories/:repositoryUid/tree/nodepath'), catchError(treeListController.getNodePath));
router.get('/:repositoryUid/tree', permit('repositories/:repositoryUid/tree'), catchError(treeListController.getTreeData));

module.exports = router;