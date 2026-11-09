const PDFDocument = require('pdfkit');
const { stringify } = require('csv-stringify');
const ExcelJS = require('xlsx');
const Event = require('../models/Event');
const Newsletter = require('../models/Newsletter');
const logger = require('../utils/logger');
const Publication = require('../models/Publication');
const Patent = require('../models/Patent');
const FacultyAchievement = require('../models/FacultyAchievement');
const NptelCourse = require('../models/NptelCourse');

class ExportService {
  static async exportEvents(filters = {}, format = 'CSV', reportMeta = {}) {
    try {
      const query = {};
      if (filters.status) query.status = filters.status;
      if (filters.department) query.department = filters.department;
      if (filters.dateFrom || filters.dateTo) {
        query.eventDate = {};
        if (filters.dateFrom) query.eventDate.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.eventDate.$lte = new Date(filters.dateTo);
      }

      const events = await Event.find(query)
        .populate('department', 'name')
        .populate('createdBy', 'firstName lastName email');

      const data = events.map((event) => ({
        'Event Name': event.eventName,
        'Type': event.eventType,
        'Description': event.description,
        'Date': event.eventDate.toDateString(),
        'Location': event.location || 'N/A',
        'Department': event.department?.name || 'N/A',
        'Status': event.status,
        'Expected Attendance': event.expectedAttendance || 'N/A',
        'Budget': event.budget || 'N/A',
        'Created By': event.createdBy?.firstName + ' ' + event.createdBy?.lastName,
      }));

      if (format === 'CSV') {
        return this.generateCSV(data);
      } else if (format === 'EXCEL') {
        return this.generateExcel(data, 'Events');
      } else if (format === 'PDF') {
        return this.generatePDF(data, 'Events Report', reportMeta);
      }
    } catch (error) {
      logger.error('Export events error:', error.message);
      throw error;
    }
  }

  static async exportNewsletters(filters = {}, format = 'CSV', reportMeta = {}) {
    try {
      const query = {};
      if (filters.status) query.status = filters.status;
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
      }

      const newsletters = await Newsletter.find(query)
        .populate('createdBy', 'firstName lastName email');

      const data = newsletters.map((nl) => ({
        'Name': nl.name,
        'Status': nl.status,
        'Period Start': nl.periodStartDate.toDateString(),
        'Period End': nl.periodEndDate.toDateString(),
        'Total Sent': nl.deliveryStats?.totalSent || 0,
        'Delivered': nl.deliveryStats?.delivered || 0,
        'Opened': nl.deliveryStats?.opened || 0,
        'Clicked': nl.deliveryStats?.clicked || 0,
        'Published Date': nl.publishedAt ? new Date(nl.publishedAt).toDateString() : 'N/A',
        'Created By': nl.createdBy?.firstName + ' ' + nl.createdBy?.lastName,
      }));

      if (format === 'CSV') {
        return this.generateCSV(data);
      } else if (format === 'EXCEL') {
        return this.generateExcel(data, 'Newsletters');
      } else if (format === 'PDF') {
        return this.generatePDF(data, 'Newsletters Report', reportMeta);
      }
    } catch (error) {
      logger.error('Export newsletters error:', error.message);
      throw error;
    }
  }

  static async exportPublications(filters = {}, format = 'CSV', reportMeta = {}) {
    try {
      const query = {};
      if (filters.status) query.status = filters.status;
      if (filters.department) query.department = filters.department;
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
      }

      const publications = await Publication.find(query)
        .populate('department', 'name')
        .populate('submittedBy', 'firstName lastName email');

      const data = publications.map((pub) => ({
        'Title': pub.title,
        'Authors': (pub.authors || []).join(', '),
        'Type': pub.publicationType,
        'Venue': pub.venueName,
        'DOI': pub.doi || 'N/A',
        'Indexing': (pub.indexing || []).join(', ') || 'N/A',
        'Department': pub.department?.name || 'N/A',
        'Status': pub.status,
        'Submitted Date': pub.createdAt.toDateString(),
        'Submitted By': pub.submittedBy ? `${pub.submittedBy.firstName} ${pub.submittedBy.lastName}` : 'N/A',
      }));

      if (format === 'CSV') return this.generateCSV(data);
      if (format === 'EXCEL') return this.generateExcel(data, 'Publications');
      if (format === 'PDF') return this.generatePDF(data, 'Publications Report', reportMeta);
    } catch (error) {
      logger.error('Export publications error:', error.message);
      throw error;
    }
  }

  static async exportPatents(filters = {}, format = 'CSV', reportMeta = {}) {
    try {
      const query = {};
      if (filters.status) query.status = filters.status;
      if (filters.department) query.department = filters.department;
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
      }

      const patents = await Patent.find(query)
        .populate('department', 'name')
        .populate('submittedBy', 'firstName lastName email');

      const data = patents.map((p) => ({
        'Title': p.title,
        'Inventors': (p.inventors || []).join(', '),
        'Patent Number': p.patentNumber || 'N/A',
        'Granting Authority': p.grantingAuthority,
        'Grant Status': p.grantStatus,
        'Filing Date': p.filingDate ? p.filingDate.toDateString() : 'N/A',
        'Grant Date': p.grantDate ? p.grantDate.toDateString() : 'N/A',
        'Department': p.department?.name || 'N/A',
        'Status': p.status,
        'Submitted By': p.submittedBy ? `${p.submittedBy.firstName} ${p.submittedBy.lastName}` : 'N/A',
      }));

      if (format === 'CSV') return this.generateCSV(data);
      if (format === 'EXCEL') return this.generateExcel(data, 'Patents');
      if (format === 'PDF') return this.generatePDF(data, 'Patents Report', reportMeta);
    } catch (error) {
      logger.error('Export patents error:', error.message);
      throw error;
    }
  }

  static async exportFacultyAchievements(filters = {}, format = 'CSV', reportMeta = {}) {
    try {
      const query = {};
      if (filters.status) query.status = filters.status;
      if (filters.department) query.department = filters.department;
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
      }

      const achievements = await FacultyAchievement.find(query)
        .populate('department', 'name')
        .populate('submittedBy', 'firstName lastName email');

      const data = achievements.map((a) => ({
        'Title': a.title,
        'Category': a.category,
        'Description': a.description,
        'Awarding Body': a.awardingBody || 'N/A',
        'Amount': a.amount || 'N/A',
        'Achievement Date': a.achievementDate.toDateString(),
        'Department': a.department?.name || 'N/A',
        'Status': a.status,
        'Submitted By': a.submittedBy ? `${a.submittedBy.firstName} ${a.submittedBy.lastName}` : 'N/A',
      }));

      if (format === 'CSV') return this.generateCSV(data);
      if (format === 'EXCEL') return this.generateExcel(data, 'Faculty Achievements');
      if (format === 'PDF') return this.generatePDF(data, 'Faculty Achievements Report', reportMeta);
    } catch (error) {
      logger.error('Export faculty achievements error:', error.message);
      throw error;
    }
  }

  static async exportNptelCourses(filters = {}, format = 'CSV', reportMeta = {}) {
    try {
      const query = {};
      if (filters.department) query.department = filters.department;
      if (filters.dateFrom || filters.dateTo) {
        query.completionDate = {};
        if (filters.dateFrom) query.completionDate.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.completionDate.$lte = new Date(filters.dateTo);
      }

      const courses = await NptelCourse.find(query)
        .populate('department', 'name')
        .populate('faculty', 'firstName lastName email');

      const data = courses.map((c) => ({
        'Course Name': c.courseName,
        'Faculty': c.faculty ? `${c.faculty.firstName} ${c.faculty.lastName}` : 'N/A',
        'Platform': c.platform || 'N/A',
        'Duration': c.duration || 'N/A',
        'Start Date': c.startDate ? c.startDate.toDateString() : 'N/A',
        'Completion Date': c.completionDate ? c.completionDate.toDateString() : 'N/A',
        'Certificate Earned': c.certificateEarned ? 'Yes' : 'No',
        'Score': c.score || 'N/A',
        'Department': c.department?.name || 'N/A',
      }));

      if (format === 'CSV') return this.generateCSV(data);
      if (format === 'EXCEL') return this.generateExcel(data, 'NPTEL Courses');
      if (format === 'PDF') return this.generatePDF(data, 'NPTEL Courses Report', reportMeta);
    } catch (error) {
      logger.error('Export NPTEL courses error:', error.message);
      throw error;
    }
  }

  static generateCSV(data) {
    return new Promise((resolve, reject) => {
      let csvContent = '';

      stringify(data, {
        header: true,
      }).on('data', (chunk) => {
        csvContent += chunk;
      }).on('end', () => {
        resolve(csvContent);
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  static generateExcel(data, sheetName = 'Sheet1') {
    try {
      const workbook = ExcelJS.utils.book_new();
      const worksheet = ExcelJS.utils.json_to_sheet(data);
      ExcelJS.utils.book_append_sheet(workbook, worksheet, sheetName);

      const buffer = ExcelJS.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      return buffer;
    } catch (error) {
      logger.error('Generate excel error:', error.message);
      throw error;
    }
  }

  static generatePDF(data, typeLabel = 'Report', reportMeta = {}) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          layout: reportMeta?.settings?.pageOrientation === 'landscape' ? 'landscape' : 'portrait',
          margin: 50,
        });

        let pdfContent = Buffer.alloc(0);

        doc.on('data', (chunk) => {
          pdfContent = Buffer.concat([pdfContent, chunk]);
        });

        doc.on('end', () => {
          resolve(pdfContent);
        });

        const { name, description, settings = {} } = reportMeta;
        const includeSummary = settings.includeSummary !== false; // default on
        const includeCharts = !!settings.includeCharts;

        // ---- Title page ----
        // The report's own name (what the person actually typed when
        // building it) is the headline; the generic type label becomes a
        // subtitle underneath, so the document reads as *their* report
        // rather than a bare, unlabeled data dump.
        doc.fontSize(22).font('Helvetica-Bold').text(name || typeLabel, { align: 'center' });
        doc.fontSize(11).font('Helvetica').fillColor('#667085').text(typeLabel, { align: 'center' });
        doc.fontSize(9).text(`Generated on ${new Date().toDateString()}`, { align: 'center' });
        doc.fillColor('#000000');
        doc.moveDown(1);

        if (description && description.trim()) {
          doc.fontSize(10).font('Helvetica-Bold').text('Description');
          doc.fontSize(10).font('Helvetica').fillColor('#333333').text(description.trim());
          doc.fillColor('#000000');
          doc.moveDown(1);
        }

        // ---- Summary section ----
        // Genuinely computed from the data being exported — total record
        // count, plus a breakdown by Status if the dataset has one —
        // rather than the "Include Summary" checkbox being captured on
        // the form and then silently ignored, as it was before.
        let statusCounts = null;
        if (includeSummary) {
          doc.fontSize(13).font('Helvetica-Bold').text('Summary');
          doc.moveDown(0.3);
          doc.fontSize(10).font('Helvetica').text(`Total records: ${data.length}`);

          if (data.length > 0 && 'Status' in data[0]) {
            statusCounts = data.reduce((acc, row) => {
              const key = row.Status || 'Unknown';
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            }, {});
            Object.entries(statusCounts).forEach(([status, count]) => {
              doc.text(`  ${status}: ${count}`);
            });
          }
          doc.moveDown(1);
        }

        // ---- Simple bar chart ----
        // pdfkit has no chart primitive, so this draws one directly with
        // rect()/text() — a horizontal bar per status, scaled to the
        // widest bar, giving the "Charts & Visualizations" checkbox an
        // actual effect instead of doing nothing.
        if (includeCharts && statusCounts && Object.keys(statusCounts).length > 0) {
          doc.fontSize(13).font('Helvetica-Bold').text('Chart: Records by Status');
          doc.moveDown(0.5);

          const chartLeft = doc.x + 90;
          const maxBarWidth = doc.page.width - 100 - 90 - 50;
          const maxCount = Math.max(...Object.values(statusCounts));
          const barHeight = 14;
          const barGap = 8;
          let chartY = doc.y;

          Object.entries(statusCounts).forEach(([status, count]) => {
            doc.fontSize(8).font('Helvetica').fillColor('#000000').text(status, 50, chartY + 2, { width: 85 });
            const barWidth = maxCount > 0 ? (count / maxCount) * maxBarWidth : 0;
            doc.fillColor('#667eea').rect(chartLeft, chartY, Math.max(barWidth, 2), barHeight).fill();
            doc.fillColor('#000000').fontSize(8).text(String(count), chartLeft + barWidth + 6, chartY + 2);
            chartY += barHeight + barGap;
          });

          doc.y = chartY + 10;
          doc.x = 50;
        }

        if (data.length > 0) {
          doc.moveDown(1);
        }

        // ---- Data table ----
        const headers = Object.keys(data[0] || {});

        if (headers.length === 0) {
          doc.fontSize(11).fillColor('#667085').text('No data available for this report.', { align: 'center' });
          doc.end();
          return;
        }

        doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000').text('Detail');
        doc.moveDown(0.5);

        const tableLeft = 50;
        const tableWidth = doc.page.width - 100;
        const rowHeight = 22;
        const headerHeight = 30;

        // Column sizing. Each column first gets enough room to show its
        // widest value in full (capped, so one huge description can't eat the
        // page) and never less than its longest header word. Whatever width is
        // left over goes to the text-heavy columns.
        const CELL_PAD = 8;
        const MAX_COL_WIDTH = 90;
        const textWidth = (text, font, size) => doc.font(font).fontSize(size).widthOfString(text);

        const minWidths = headers.map((h) => {
          const headerWord = Math.max(
            Math.min(textWidth(h, 'Helvetica-Bold', 9), 60),
            ...h.split(/\s+/).map((w) => textWidth(w, 'Helvetica-Bold', 9))
          );
          const widestValue = data.reduce(
            (widest, row) => Math.max(widest, textWidth(String(row[h] ?? ''), 'Helvetica', 8)),
            0
          );
          return Math.min(Math.max(headerWord, widestValue), MAX_COL_WIDTH) + CELL_PAD;
        });

        const textWeights = headers.map((h) => {
          const avg =
            data.reduce((sum, row) => sum + Math.min(String(row[h] ?? '').length, 40), 0) /
            Math.max(data.length, 1);
          return Math.max(avg, 4);
        });

        const minTotal = minWidths.reduce((a, b) => a + b, 0);
        let colWidths;
        if (minTotal >= tableWidth) {
          // Too many columns for this page width — scale everything down.
          colWidths = minWidths.map((w) => (w / minTotal) * tableWidth);
        } else {
          const spare = tableWidth - minTotal;
          const weightTotal = textWeights.reduce((a, b) => a + b, 0);
          colWidths = minWidths.map((w, i) => w + (textWeights[i] / weightTotal) * spare);
        }

        // Each row's Y is captured ONCE and reused for every column, because
        // doc.text() advances doc.y on every call.
        function drawTableHeader(y) {
          doc.fillColor('#667eea').rect(tableLeft, y, tableWidth, headerHeight).fill();
          doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
          let x = tableLeft;
          headers.forEach((header, i) => {
            doc.text(header, x + 4, y + 6, { width: colWidths[i] - CELL_PAD, height: headerHeight - 8, ellipsis: true });
            x += colWidths[i];
          });
          return y + headerHeight;
        }

        let y = drawTableHeader(doc.y);

        data.forEach((row, idx) => {
          if (y + rowHeight > doc.page.height - 50) {
            doc.addPage();
            y = drawTableHeader(50);
          }

          doc.fillColor(idx % 2 === 0 ? '#f8f9fa' : '#ffffff');
          doc.rect(tableLeft, y, tableWidth, rowHeight).fill();

          doc.fillColor('#000000').font('Helvetica').fontSize(8);
          let x = tableLeft;
          headers.forEach((header, i) => {
            const value = String(row[header] ?? '');
            doc.text(value, x + 4, y + 6, { width: colWidths[i] - CELL_PAD, height: rowHeight - 4, ellipsis: true });
            x += colWidths[i];
          });

          y += rowHeight;
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = ExportService;