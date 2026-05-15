pipeline {
  agent any

  parameters {
    choice(name: 'ACTION', choices: ['Build and Deploy', 'Deploy Only'], description: 'Full rebuild and push? Or just re-up existing images on the VPS?')
    booleanParam(name: 'CONFIRM_TESTED', defaultValue: false, description: 'I have run the test suites locally.')
    booleanParam(name: 'TAKE_BACKUP', defaultValue: true, description: 'pg_dump + uploads tar before deploy.')
    string(name: 'OVERRIDE_TAG', defaultValue: '', description: 'Manually specify an image tag (empty = current commit short SHA).')
  }

  environment {
    VPS_HOST = "159.195.47.245"
    VPS_USER = "james"
    GITHUB_USER = "jmmd2000"
    IMAGE_TAG = "${params.OVERRIDE_TAG ?: sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()}"
    APP_NAME = "issues-production"
    DOMAIN = "issues.jamesmddoyle.com"
  }

  stages {
    stage('Safety Check') {
      when { expression { params.ACTION == 'Build and Deploy' } }
      steps {
        script {
          if (!params.CONFIRM_TESTED) {
            error "Run the test suites locally before pushing a build."
          }
        }
      }
    }

    stage('Build & Push Images') {
      when { expression { params.ACTION == 'Build and Deploy' } }
      steps {
        script {
          withCredentials([usernamePassword(credentialsId: 'github-ghcr', usernameVariable: 'GH_USER', passwordVariable: 'GH_PAT')]) {
            sh "echo ${GH_PAT} | docker login ghcr.io -u ${GH_USER} --password-stdin"

            parallel failFast: true,
              "API Build": {
                sh "docker build -f apps/api/Dockerfile -t ghcr.io/${GITHUB_USER}/issues-api:${IMAGE_TAG} ."
              },
              "Web Build": {
                sh "docker build -f apps/web/Dockerfile --build-arg PUBLIC_API_URL=https://${DOMAIN} -t ghcr.io/${GITHUB_USER}/issues-web:${IMAGE_TAG} ."
              }

            parallel(
              "API Push": {
                sh "docker push ghcr.io/${GITHUB_USER}/issues-api:${IMAGE_TAG}"
              },
              "Web Push": {
                sh "docker push ghcr.io/${GITHUB_USER}/issues-web:${IMAGE_TAG}"
              }
            )
          }
        }
      }
    }

    stage('Deploy to VPS') {
      steps {
        script {
          def targetDir = "/home/james/issues/prod"
          echo "Deploying version ${IMAGE_TAG} to ${DOMAIN}..."

          sshagent(['vps-ssh']) {
            sh "ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} 'mkdir -p ${targetDir} ${targetDir}/data/uploads'"

            sh "scp -o StrictHostKeyChecking=no docker-compose.yml ${VPS_USER}@${VPS_HOST}:${targetDir}/docker-compose.yml"
            sh "scp -o StrictHostKeyChecking=no backup.sh ${VPS_USER}@${VPS_HOST}:${targetDir}/backup.sh"
            sh "ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} 'chmod +x ${targetDir}/backup.sh'"

            withCredentials([file(credentialsId: 'issues-env-prod', variable: 'ENV_FILE')]) {
              sh "scp -o StrictHostKeyChecking=no ${ENV_FILE} ${VPS_USER}@${VPS_HOST}:${targetDir}/.env"
            }
            sh "ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} 'chmod 600 ${targetDir}/.env'"

            sh """
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} << "ENDSSH"
cd ${targetDir}
# Ensure trailing newline before append (some editors omit it)
[ -z "\$(tail -c1 .env)" ] || printf '\\n' >> .env
printf 'IMAGE_TAG=%s\\nGITHUB_USER=%s\\nAPP_NAME=%s\\nDOMAIN=%s\\n' "${IMAGE_TAG}" "${GITHUB_USER}" "${APP_NAME}" "${DOMAIN}" >> .env
ENDSSH
"""

            if (params.TAKE_BACKUP) {
              echo "Taking backup before deploying..."
              sh "ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} 'cd ${targetDir} && ./backup.sh || echo \"Backup failed but proceeding...\"'"
            }

            sh """
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} << "ENDSSH"
cd ${targetDir}
docker compose pull
docker compose up -d --remove-orphans
ENDSSH
"""
          }
        }
      }
    }
  }

  post {
    success {
      echo "Successfully deployed ${IMAGE_TAG} to ${DOMAIN}."
    }
    failure {
      echo "Deployment failed. Check the console output and the VPS logs (docker compose -f ~/issues/prod/docker-compose.yml logs)."
    }
  }
}
