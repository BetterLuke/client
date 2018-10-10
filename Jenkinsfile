#!groovy

node {
    checkout scm

    nodeEnv = docker.image("node:10")
    workspace = pwd()

    stage 'Build'
    nodeEnv.inside("-e HOME=${workspace}") {
        sh "echo Building Hypothesis client"
        sh 'make clean'
        sh 'make'
    }

    stage 'Test'
    nodeEnv.inside("-e HOME=${workspace}") {
        sh 'make test'
    }

    // XXX
    // if (env.BRANCH_NAME != 'master') {
    //   return
    // }

    stage 'Publish'

    input(message: "Publish new client release?")

    nodeEnv.inside("-e HOME=${workspace}") {
        withCredentials([
            [$class: 'StringBinding', credentialsId: 'npm-token', variable: 'NPM_TOKEN'],
            [$class: 'StringBinding', credentialsId: 'github-jenkins', variable: 'GITHUB_TOKEN']]) {

            sh "git config --global user.email dev@list.hypothes.is"
            sh "git config --global user.name 'Hypothesis Developers'"
            sh "yarn version --minor"

            // Use `npm` rather than `yarn` for publishing.
            // See https://github.com/yarnpkg/yarn/pull/3391.
            sh "echo '//registry.npmjs.org/:_authToken=${env.NPM_TOKEN}' >> \$HOME/.npmrc"
            // XXX - sh "npm publish"
            // TODO - Wait until npm reports that the client has been released.
        }
    }

    pkgVersion = sh (
      script: 'cat package.json | jq -r .version',
      returnStdout: true
    ).trim()

    nodeEnv.inside("e HOME=${workspace}") {
      sh "echo Uploading package version ${pkgVersion}"
    }
    // Upload the contents of the package to an S3 bucket, which it
    // will then be served from.
    // XXX
    // docker.image('nickstenning/s3-npm-publish')
    //       .withRun('', "hypothesis@${pkgVersion} s3://cdn.hypothes.is") { c ->
    //         sh "docker logs --follow ${c.id}"
    //       }
}
