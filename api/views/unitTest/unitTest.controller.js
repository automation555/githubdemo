import {getCoverageOverall} from '../codeCoverage/codeCoverage.controller';

export async function index(req,res,next){
    return getCoverageOverall(req,res,next);
}