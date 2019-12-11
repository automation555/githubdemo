import express from 'express';
import * as localisationController from './localisation.controller';
import { catchError } from './../../../errors/error';

let router = express.Router({ mergeParams: true });

//Search
router.get('/', catchError(localisationController.getLocalisationTexts));

module.exports = router;