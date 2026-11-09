const Department = require('../models/Department');
const AppError = require('../utils/AppError');
const User = require('../models/User');

class DepartmentService {
  async createDepartment(input) {
    const data = { ...input };
    if (typeof data.name === 'string') data.name = data.name.trim();
    if (typeof data.code === 'string') data.code = data.code.trim().toUpperCase();
    const existing = await Department.findOne({
      $or: [{ name: data.name }, { code: data.code }],
    });

    if (existing) {
      throw new AppError('A department with this name or code already exists', 400);
    }

    const department = await Department.create(data);
    return department;
  }

  async getAllDepartments(includeInactive = false) {
    const filter = includeInactive ? {} : { isActive: true };

    const departments = await Department.find(filter)
      .populate('head', 'firstName lastName email')
      .populate('parentDepartment', 'name code')
      .sort({ name: 1 });

    return departments;
  }

  async getDepartmentById(id) {
    const department = await Department.findById(id)
      .populate('head', 'firstName lastName email')
      .populate('parentDepartment', 'name code');

    if (!department) {
      throw new AppError('Department not found', 404);
    }

    return department;
  }

  async updateDepartment(id, input) {
    // Only these fields can be changed through the API.
    const ALLOWED = ['name', 'code', 'description', 'email', 'phone', 'head', 'parentDepartment', 'isActive'];
    const data = {};
    ALLOWED.forEach((key) => {
      if (input[key] !== undefined) data[key] = input[key];
    });
    if (typeof data.name === 'string') data.name = data.name.trim();
    if (typeof data.code === 'string') data.code = data.code.trim().toUpperCase();
    if (data.name || data.code) {
      const existing = await Department.findOne({
        _id: { $ne: id },
        $or: [
          ...(data.name ? [{ name: data.name }] : []),
          ...(data.code ? [{ code: data.code }] : []),
        ],
      });

      if (existing) {
        throw new AppError('A department with this name or code already exists', 400);
      }
    }

    data.updatedAt = Date.now();

    const department = await Department.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!department) {
      throw new AppError('Department not found', 404);
    }

    return department;
  }

  async deleteDepartment(id) {
    // Don't strand people: a department with active users can't be deactivated.
    const activeUsers = await User.countDocuments({ department: id, isActive: true });
    if (activeUsers > 0) {
      throw new AppError(
        `This department still has ${activeUsers} active user${activeUsers === 1 ? '' : 's'}. Move or deactivate them first.`,
        400
      );
    }
    const department = await Department.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );

    if (!department) {
      throw new AppError('Department not found', 404);
    }

    return { message: 'Department deactivated successfully' };
  }
}

module.exports = new DepartmentService();