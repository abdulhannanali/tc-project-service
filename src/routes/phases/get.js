
import _ from 'lodash';
import { middleware as tcMiddleware } from 'tc-core-library-js';
import util from '../../util';
import models from '../../models';

const permissions = tcMiddleware.permissions;
const populateMemberDetails = async (phase, logger, id) => {
  if (phase.members && phase.members.length > 0) {
    const details = await util.getMemberDetailsByUserIds(_.map(phase.members, 'userId'), logger, id);
    _.forEach(phase.members, (member) => {
      _.assign(member, _.find(details, detail => detail.userId === member.userId));
    });
  }
  return phase;
};
module.exports = [
  permissions('project.view'),
  (req, res, next) => {
    const projectId = _.parseInt(req.params.projectId);
    const phaseId = _.parseInt(req.params.phaseId);

    util.fetchByIdFromES('phases', {
      query: {
        nested: {
          path: 'phases',
          query:
          {
            filtered: {
              filter: {
                bool: {
                  must: [
                    { term: { 'phases.id': phaseId } },
                    { term: { 'phases.projectId': projectId } },
                  ],
                },
              },
            },
          },
          inner_hits: {},
        },
      },
    })
      .then((data) => {
        if (data.length === 0) {
          req.log.debug('No phase found in ES');
          return models.ProjectPhase
            .findOne({
              where: { id: phaseId, projectId },
              include: [{
                model: models.ProjectPhaseMember,
                as: 'members',
              }],
            })
            .then((phase) => {
              if (!phase) {
              // handle 404
                const err = new Error('project phase not found for project id ' +
                    `${projectId} and phase id ${phaseId}`);
                err.status = 404;
                throw err;
              }
              return populateMemberDetails(phase.toJSON(), req.log, req.id)
                .then(result => res.json(result));
            })
            .catch(err => next(err));
        }
        req.log.debug('phase found in ES');
        // eslint-disable-next-line no-underscore-dangle
        return populateMemberDetails(data[0].inner_hits.phases.hits.hits[0]._source, req.log, req.id)
          .then(phase => res.json(phase));
      })
      .catch(next);
  },
];
