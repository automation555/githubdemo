import * as cf from '../../../utils/common-functions';
const errors = require('throw.js');

//Get search result

export async function getWebsiteHost(req, res, next) {
    res.status(200).json(cf.getWebSiteURL());
}

export async function validateUrl(req, res, next) {
    res.status(200).send('ok');
}