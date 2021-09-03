/**
 * API to delete a project template
 */
import validate from 'express-validation';
import _ from 'lodash';
import Joi from 'joi';
import { middleware as tcMiddleware } from 'tc-core-library-js';
import { EVENT, RESOURCES } from '../../constants';
import util from '../../util';
import models from '../../models';

const permissions = tcMiddleware.permissions;

const schema = {
  params: {
    templateId: Joi.number().integer().positive().required(),
  },
};

module.exports = [
  validate(schema),
  permissions('projectTemplate.delete'),
  (req, res, next) => {
    let result;
    models.sequelize.transaction(() =>
      models.ProjectTemplate.findByPk(req.params.templateId)
        .then((entity) => {
          if (!entity) {
            const apiErr = new Error(`Project template not found for template id ${req.params.templateId}`);
            apiErr.status = 404;
            return Promise.reject(apiErr);
          }
          // Update the deletedBy, then delete
          return entity.update({ deletedBy: req.authUser.userId });
        })
        .then(entity => entity.destroy())
        .then((entity) => {
          result = entity.toJSON();
          return entity;
        })
        .then(entity => util.updateMetadataFromES(req.log,
          util.generateDeleteDocFunction(_.get(entity.toJSON(), 'id'), 'projectTemplates')).then(() => entity)))
      .then((entity) => {
        // emit event
        util.sendResourceToKafkaBus(
          req,
          EVENT.ROUTING_KEY.PROJECT_METADATA_DELETE,
          RESOURCES.PROJECT_TEMPLATE,
          _.pick(entity.toJSON(), 'id'),
        );

        res.status(204).end();
      })
      .catch((err) => {
        if (result) {
          util.publishError(result, 'projectTemplate.delete', req.log);
        }
        next(err);
      });
  },
];
