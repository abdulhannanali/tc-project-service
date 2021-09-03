/**
 * API to add a priceConfig revision
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
    key: Joi.string().max(45).required(),
    version: Joi.number().integer().positive().required(),
  },
  body: Joi.object().keys({
    config: Joi.object().required(),

    createdAt: Joi.any().strip(),
    updatedAt: Joi.any().strip(),
    deletedAt: Joi.any().strip(),
    createdBy: Joi.any().strip(),
    updatedBy: Joi.any().strip(),
    deletedBy: Joi.any().strip(),
  }).required(),
};

module.exports = [
  validate(schema),
  permissions('priceConfig.create'),
  (req, res, next) => {
    models.sequelize.transaction(() => models.PriceConfig.findOne({
      where: {
        key: req.params.key,
        version: req.params.version,
      },
      order: [['revision', 'DESC']],
    }).then((priceConfig) => {
      if (priceConfig) {
        const version = priceConfig ? priceConfig.version : 1;
        const revision = priceConfig ? priceConfig.revision + 1 : 1;
        const entity = _.assign(req.body, {
          version,
          revision,
          createdBy: req.authUser.userId,
          updatedBy: req.authUser.userId,
          key: req.params.key,
          config: req.body.config,
        });
        return models.PriceConfig.create(entity);
      }
      const apiErr = new Error(`PriceConfig not exists for key ${req.params.key} version ${req.params.version}`);
      apiErr.status = 404;
      return Promise.reject(apiErr);
    }).then(createdEntity => util.updateMetadataFromES(req.log,
      util.generateCreateDocFunction(createdEntity.toJSON(), 'priceConfigs'))
      .then(() => createdEntity)).then((createdEntity) => {
      util.sendResourceToKafkaBus(req,
        EVENT.ROUTING_KEY.PROJECT_METADATA_CREATE,
        RESOURCES.PRICE_CONFIG_REVISION,
        createdEntity.toJSON());
      // Omit deletedAt, deletedBy
      res.status(201).json(_.omit(createdEntity.toJSON(), 'deletedAt', 'deletedBy'));
    })
      .catch(next));
  },
];
