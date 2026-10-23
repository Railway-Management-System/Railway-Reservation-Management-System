const {
  createComplaint,
  getUserComplaints,
  getAdminComplaints,
  updateAdminComplaint
} = require('../services/complaintService');
const AppError = require('../utils/appError');

async function submitComplaint(req, res, next) {
  try {
    if (req.user.role !== 'PASSENGER') {
      throw new AppError('FORBIDDEN', 'Access denied: only passengers can file complaints', 403);
    }

    const userId = req.user.userId || req.user.user_id;
    const { category, subject, description } = req.body;

    const complaint = await createComplaint({
      userId,
      category,
      subject,
      description
    });

    return res.status(201).json({
      success: true,
      data: complaint
    });
  } catch (error) {
    next(error);
  }
}

async function getMyComplaints(req, res, next) {
  try {
    if (req.user.role !== 'PASSENGER') {
      throw new AppError('FORBIDDEN', 'Access denied: only passengers can view their complaints', 403);
    }

    const userId = req.user.userId || req.user.user_id;
    const complaints = await getUserComplaints(userId);

    return res.status(200).json({
      success: true,
      data: complaints
    });
  } catch (error) {
    next(error);
  }
}

async function adminListComplaints(req, res, next) {
  try {
    if (req.user.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Access denied: ADMIN role required', 403);
    }

    const { status } = req.query;
    const complaints = await getAdminComplaints({ status });

    return res.status(200).json({
      success: true,
      data: complaints
    });
  } catch (error) {
    next(error);
  }
}

async function adminUpdateComplaint(req, res, next) {
  try {
    if (req.user.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Access denied: ADMIN role required', 403);
    }

    const { grievanceId } = req.params;
    const { response, status } = req.body;

    const updated = await updateAdminComplaint(grievanceId, { response, status });

    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  submitComplaint,
  getMyComplaints,
  adminListComplaints,
  adminUpdateComplaint
};
