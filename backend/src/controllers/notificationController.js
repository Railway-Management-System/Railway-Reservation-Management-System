const { getUserNotifications, markNotificationRead } = require('../services/notificationService');

async function getMyNotifications(req, res, next) {
  try {
    const userId = req.user.userId || req.user.user_id;
    const notifications = await getUserNotifications(userId);
    return res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
}

async function markAsRead(req, res, next) {
  try {
    const userId = req.user.userId || req.user.user_id;
    const { id } = req.params;
    const updated = await markNotificationRead(id, userId);
    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyNotifications,
  markAsRead
};
