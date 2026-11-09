const User = require('../models/User');
const NotificationService = require('./notificationService');
const EmailService = require('./emailService');
const logger = require('../utils/logger');

const idOf = (value) => String(value?._id || value || '');

const ITEM_LABELS = {
    event: 'event',
    publication: 'publication',
    patent: 'patent',
    achievement: 'achievement',
};

// Events keep their own notification types; every other item type shares
// the general ones.
function typeFor(itemType, kind) {
    if (itemType === 'event') {
        return { requested: 'EVENT_SUBMITTED', approved: 'EVENT_APPROVED', rejected: 'EVENT_REJECTED' }[kind];
    }
    return { requested: 'APPROVAL_REQUESTED', approved: 'ITEM_APPROVED', rejected: 'ITEM_REJECTED' }[kind];
}

// The notification's data field only keeps eventId for events and
// itemId/itemType for everything else.
function dataFor(itemType, itemId, relatedUrl) {
    return itemType === 'event'
        ? { eventId: itemId, relatedUrl }
        : { itemId, itemType, relatedUrl };
}

// A monthly report submits many items in a row. Email the coordinator once per
// submitter every 10 minutes (the bell still shows every item).
const lastEmailed = new Map();
const EMAIL_WINDOW_MS = 10 * 60 * 1000;
function shouldEmail(approver, submitter) {
    const key = `${idOf(approver._id)}:${idOf(submitter?._id)}`;
    const now = Date.now();
    if (now - (lastEmailed.get(key) || 0) < EMAIL_WINDOW_MS) return false;
    lastEmailed.set(key, now);
    return true;
}

// Who should decide on a new submission?
//  - the active Coordinator(s) of the item's CLUSTER within its department,
//    except the person who submitted it (nobody approves their own work);
//  - Super Admins instead when that cluster has no other active Coordinator,
//    or when the submitter is a Coordinator, so a submission is never left
//    with nobody to decide on it.
// Items without a cluster (older data) go to the department's Coordinators.
async function findApprovers({ departmentId, cluster, submitter }) {
    const submitterId = idOf(submitter?._id);
    const select = 'firstName lastName email role';
    const byId = new Map();

    if (departmentId) {
        const query = {
            role: 'COORDINATOR',
            department: departmentId,
            isActive: { $ne: false },
        };
        if (cluster) query.clusters = cluster;

        const coordinators = await User.find(query).select(select);
        coordinators.forEach((u) => {
            if (idOf(u._id) !== submitterId) byId.set(idOf(u._id), u);
        });
    }

    if (byId.size === 0 || submitter?.role === 'COORDINATOR') {
        const admins = await User.find({
            role: 'SUPER_ADMIN',
            isActive: { $ne: false },
        }).select(select);
        admins.forEach((u) => {
            if (idOf(u._id) !== submitterId) byId.set(idOf(u._id), u);
        });
    }

    return [...byId.values()];
}

// Sends every approver a bell notification AND an email. It never throws:
// a failed notification or email must not make the submission itself fail.
async function notifyApprovers({
    itemType,
    itemId,
    title,
    departmentId,
    departmentName,
    cluster,
    submitter,
    io = null,
    isResubmission = false,
}) {
    const summary = { approvers: 0, notified: 0, emailed: 0 };

    try {
        const label = ITEM_LABELS[itemType] || 'submission';
        const approvers = await findApprovers({ departmentId, cluster, submitter });
        summary.approvers = approvers.length;

        if (approvers.length === 0) {
            logger.warn(`No approver found for a new ${label} in department ${idOf(departmentId)}`);
            return summary;
        }

        const submitterName =
            `${submitter?.firstName || ''} ${submitter?.lastName || ''}`.trim() || 'A faculty member';

        const notifTitle = isResubmission
            ? `Revised ${label} awaiting your approval`
            : `New ${label} awaiting your approval`;
        const notifMsg = isResubmission
            ? `${submitterName} updated and resubmitted "${title}"${cluster ? ` (${cluster})` : ''}`
            : `${submitterName} submitted "${title}"${cluster ? ` (${cluster})` : ''}`;

        for (const approver of approvers) {
            try {
                await NotificationService.createNotification(
                    {
                        recipient: approver._id,
                        sender: submitter?._id,
                        type: typeFor(itemType, 'requested'),
                        title: notifTitle,
                        message: notifMsg,
                        data: dataFor(itemType, itemId, '/approvals'),
                    },
                    io
                );
                summary.notified += 1;
            } catch (error) {
                logger.error(`Approval notification failed for ${approver.email}:`, error.message);
            }

            // Only the cluster's Coordinator is emailed. A Super Admin who is
            // here as a fallback gets the bell notification only.
            if (approver.role === 'COORDINATOR' && (isResubmission || shouldEmail(approver, submitter))) {
                try {
                    await EmailService.sendApprovalRequestEmail(approver, {
                        itemLabel: label,
                        title,
                        submitterName,
                        departmentName: [departmentName, cluster].filter(Boolean).join(' › '),
                        isResubmission,
                    });
                    summary.emailed += 1;
                } catch (error) {
                    logger.error(`Approval email failed for ${approver.email}:`, error.message);
                }
            }
        }

        logger.info(
            `Approval request for ${label} "${title}": ${summary.notified}/${summary.approvers} notified, ${summary.emailed} emailed`
        );
    } catch (error) {
        logger.error('notifyApprovers error:', error.message);
    }

    return summary;
}

// Tells the person who submitted an item that it was approved or rejected
// (bell notification; the email is sent separately by the caller). Never throws.
async function notifySubmitter({
    itemType,
    itemId,
    title,
    decision, // 'APPROVED' | 'REJECTED'
    feedback,
    submitterId,
    decider,
    relatedUrl = '/dashboard',
    io = null,
}) {
    try {
        if (!submitterId) return false;
        const label = ITEM_LABELS[itemType] || 'submission';
        const approved = decision === 'APPROVED';

        await NotificationService.createNotification(
            {
                recipient: submitterId,
                sender: decider?._id,
                type: typeFor(itemType, approved ? 'approved' : 'rejected'),
                title: approved ? `Your ${label} was approved` : `Your ${label} needs changes`,
                message: approved
                    ? `"${title}" was approved`
                    : `"${title}" was not approved${feedback ? `: ${feedback}` : ''}`,
                data: dataFor(itemType, itemId, relatedUrl),
            },
            io
        );
        return true;
    } catch (error) {
        logger.error('notifySubmitter error:', error.message);
        return false;
    }
}

// After a Coordinator approves something, every Super Admin gets a bell
// notification (the month-end email digest is sent separately). The admin who
// made the decision is not notified about their own action. Never throws.
async function notifyAdminsOfApproval({
    itemType,
    itemId,
    title,
    departmentName,
    cluster,
    submitterName,
    approver,
    io = null,
}) {
    try {
        const label = ITEM_LABELS[itemType] || 'submission';
        const admins = await User.find({
            role: 'SUPER_ADMIN',
            isActive: { $ne: false },
        }).select('_id');

        const approverName =
            `${approver?.firstName || ''} ${approver?.lastName || ''}`.trim() || 'a coordinator';
        const where = [departmentName, cluster].filter(Boolean).join(' › ');

        for (const admin of admins) {
            if (idOf(admin._id) === idOf(approver?._id)) continue;
            try {
                await NotificationService.createNotification(
                    {
                        recipient: admin._id,
                        sender: approver?._id,
                        type: 'APPROVAL_COMPLETED',
                        title: `${label.charAt(0).toUpperCase()}${label.slice(1)} approved`,
                        message:
                            `"${title}"${submitterName ? ` by ${submitterName}` : ''} was approved by ${approverName}` +
                            `${where ? ` (${where})` : ''}`,
                        data: dataFor(itemType, itemId, '/approvals'),
                    },
                    io
                );
            } catch (error) {
                logger.error('Admin approval notification failed:', error.message);
            }
        }
    } catch (error) {
        logger.error('notifyAdminsOfApproval error:', error.message);
    }
}

module.exports = { notifyApprovers, notifySubmitter, notifyAdminsOfApproval, findApprovers };