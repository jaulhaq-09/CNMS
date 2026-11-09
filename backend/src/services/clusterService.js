const Cluster = require('../models/Cluster');
const AppError = require('../utils/AppError');

class ClusterService {
  async createCluster(data) {
    const existing = await Cluster.findOne({ department: data.department, name: data.name });
    if (existing) {
      throw new AppError('A cluster with this name already exists in this department', 400);
    }

    const cluster = await Cluster.create(data);
    return cluster;
  }

  async getClustersByDepartment(departmentId, includeInactive = false) {
    const filter = { department: departmentId };
    if (!includeInactive) filter.isActive = true;

    const clusters = await Cluster.find(filter).sort({ name: 1 });
    return clusters;
  }

  async deleteCluster(id) {
    const cluster = await Cluster.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!cluster) {
      throw new AppError('Cluster not found', 404);
    }
    return { message: 'Cluster deactivated successfully' };
  }
}

module.exports = new ClusterService();