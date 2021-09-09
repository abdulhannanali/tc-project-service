/**
 * API to add a project type
 */
import validate from 'express-validation';
import _ from 'lodash';
import Joi from 'joi';
import { middleware as tcMiddleware } from 'tc-core-library-js';
import { EVENT, RESOURCES } from '../../../constants';
import util from '../../../util';
import models from '../../../models';

const permissions = tcMiddleware.permissions;

const schema = {
  params: {
    version: Joi.number().integer().positive().required(),
    key: Joi.string().max(45).required(),
  },
};

module.exports = [
  validate(schema),
  permissions('priceConfig.create'),
  (req, res, next) => {
    let result;
    models.sequelize.transaction(() => models.PriceConfig.findAll(
      {
        where: {
          key: req.params.key,
          version: req.params.version,
        },
      }).then((allRevision) => {
      if (allRevision.length === 0) {
        const apiErr = new Error(`PriceConfig not found for key ${req.params.key} version ${req.params.version}`);
        apiErr.status = 404;
        return Promise.reject(apiErr);
      }
      return models.PriceConfig.update(
        {
          deletedBy: req.authUser.userId,
        }, {
          where: {
            key: req.params.key,
            version: req.params.version,
          },
        });
    })
      .then(() => models.PriceConfig.destroy({
        where: {
          key: req.params.key,
          version: req.params.version,
        },
      }))
      .then((deleted) => {
        result = deleted;
        return deleted;
      })
      .then(deleted => models.PriceConfig.findAll({
        where: {
          key: req.params.key,
          version: req.params.version,
        },
        paranoid: false,
        order: [['deletedAt', 'DESC']],
        limit: deleted,
      }))
      .then(priceConfigs => util.updateMetadataFromES(req.log, (source) => {
        const ids = _.map(priceConfigs, f => _.get(f.toJSON, 'id'));
        const remains = _.filter(source.priceConfigs, single => !_.includes(ids, single.id));
        return _.assign(source, { priceConfigs: remains });
      }).then(() => priceConfigs))
      .then((priceConfigs) => {
        _.map(priceConfigs, priceConfig => util.sendResourceToKafkaBus(req,
          EVENT.ROUTING_KEY.PROJECT_METADATA_DELETE,
          RESOURCES.PRICE_CONFIG_VERSION,
          _.pick(priceConfig.toJSON(), 'id')));
        res.status(204).end();
      })
      .catch((err) => {
        if (result) {
          util.publishError(result, 'priceConfig.version.delete', req.log);
        }
        next(err);
      }));
  },
];
