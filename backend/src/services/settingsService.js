const Settings = require('../models/Settings');
const logger = require('../utils/logger');

class SettingsService {
  // Get-or-create: if no settings document exists yet (fresh install),
  // create one with schema defaults rather than making every caller
  // handle a null case.
  static async getSettings() {
    try {
      let settings = await Settings.findOne();
      if (!settings) {
        settings = await Settings.create({});
        logger.info('Settings document created with defaults');
      }
      return settings;
    } catch (error) {
      logger.error('Get settings error:', error.message);
      throw error;
    }
  }

  static async updateSettings(updateData, userId) {
    try {
      const settings = await Settings.findOneAndUpdate(
        {},
        { ...updateData, updatedAt: new Date(), updatedBy: userId },
        { new: true, upsert: true, runValidators: true }
      );

      logger.info(`Settings updated by ${userId}`);

      return settings;
    } catch (error) {
      logger.error('Update settings error:', error.message);
      throw error;
    }
  }
}

module.exports = SettingsService;