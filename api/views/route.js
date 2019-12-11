import { handleError } from './../../errors/error';
const errors = require('throw.js');

export default (app) => {
    // bootstrap api routes
    app.use('/api/views/repositories', require('./overview'));
    app.use('/api/views/repositories', require('./dashboard'));
    app.use('/api/views/repositories', require('./search'));
    app.use('/api/views/repositories', require('./treeList'));
    app.use('/api/views/repositories', require('./breadcrumb'));
    app.use('/api/views/repositories', require('./changeOverview'));
    app.use('/api/views/repositories', require('./hotspots'));
    app.use('/api/views/repositories', require('./designIssues'));
    app.use('/api/views/repositories', require('./codeIssues'));
    app.use('/api/views/repositories', require('./metrics'));
    app.use('/api/views/repositories', require('./duplication'));
    app.use('/api/views/repositories', require('./codeCoverage'));
    app.use('/api/views/repositories', require('./changeList'));
    app.use('/api/views/repositories', require('./componentList'));
    app.use('/api/views/repositories', require('./partitions'));
    app.use('/api/views/repositories', require('./heatMap'));
    app.use('/api/views/repositories', require('./componentExplorer'));
    app.use('/api/views/repositories', require('./complexMethod'));
    app.use('/api/views/repositories', require('./summary'));
    app.use('/api/views/repositories', require('./kpiDashboard'));
    app.use('/api/views/repositories', require('./file'));
    // app.use('/api/views/repositories', require('./pdf'));    // Removed as we are using exposed API to generate pdf report
    app.use('/api/views/repositories', require('./unitTest'));
    app.use('/api/views/repositories', require('./dependencyPlot'));
    app.use('/api/views/repositories', require('./fileExplorer'));
    app.use('/api/views/repositories', require('./downloadMetrics'));

    app.use('/api/views/metadata', require('./metadata'));
    app.use('/api/views/localisation', require('./localisation'));
    app.use('/api/views/repositories', require('./commitHistory'));
    app.use('/api/views/repositories', require('./pullRequest'));
    /* // handle 404 errors
    app.use(function (req, res, next) {
        return next(new errors.NotFound(null, 1008));
    }); */
    app.use(handleError);
};