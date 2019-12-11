import * as bitbucketCloudController from './bitbucketCloud.controller';
import * as bitbucketServerController from './bitbucketServer.controller';
import * as githubController from './github.controller';
import * as gitlabOnPremiseController from './gitlabOnPremise.controller';

export function setRepoProviderContext(repoProvider, serverType) {
    let repoProviderOption;
    switch (true) {
        case repoProvider == 'bitbucket' && serverType == 'cloud':
            repoProviderOption = bitbucketCloudController;
        break;
        case repoProvider == 'bitbucket' && serverType == 'onpremise':
            repoProviderOption = bitbucketServerController;
        break;
        case repoProvider == 'github' && serverType == 'cloud':
        case repoProvider == 'github' && serverType == 'onpremise':
            repoProviderOption = githubController;
        break;
        case repoProvider == 'gitlab' && serverType =='onpremise':
        case repoProvider == 'gitlab' && serverType =='cloud':
            repoProviderOption = gitlabOnPremiseController;
        break;
        default:
        throw new Error(repoProvider + " " + serverType + ". This repoProviderOption is not supported");
    }
    return repoProviderOption;
}