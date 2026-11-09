const Section = require('../models/Section');
const AppError = require('../utils/AppError');

class SectionService {
  async createSection(data) {
    const existing = await Section.findOne({ cluster: data.cluster, name: data.name });
    if (existing) {
      throw new AppError('A section with this name already exists in this cluster', 400);
    }

    const section = await Section.create(data);
    return section;
  }

  async getSectionsByCluster(clusterId, includeInactive = false) {
    const filter = { cluster: clusterId };
    if (!includeInactive) filter.isActive = true;

    const sections = await Section.find(filter).sort({ name: 1 });
    return sections;
  }

  async deleteSection(id) {
    const section = await Section.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!section) {
      throw new AppError('Section not found', 404);
    }
    return { message: 'Section deactivated successfully' };
  }
}

module.exports = new SectionService();