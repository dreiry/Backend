const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const db = require('../db'); // Pulls your existing database connection

router.get('/generate', async (req, res) => {
    const { reportType, format } = req.query;
    
    let query = '';
    let filename = '';

    // Filter exactly which columns to pull based on the requested report
    switch (reportType) {
        case 'master-schedule':
            // Pulls a joined view of the schedule[cite: 5]
            query = `
                SELECT 
                    gs.schedule_id, c.description AS course, s.section_id, 
                    f.name AS faculty_name, r.room_id, t.day, t.start_time, t.end_time 
                FROM generated_schedules gs
                LEFT JOIN courses c ON gs.course_code = c.course_code
                LEFT JOIN sections s ON gs.section_id = s.section_id
                LEFT JOIN faculty f ON gs.faculty_id = f.faculty_id
                LEFT JOIN rooms r ON gs.room_id = r.room_id
                LEFT JOIN timeslots t ON gs.timeslot_id = t.timeslot_id
            `;
            filename = 'Master_Department_Schedule';
            break;

        case 'faculty-load':
            // Pulls specific columns from the faculty table[cite: 5]
            query = 'SELECT faculty_id, name, employment_type, official_time_start, official_time_end, max_preparations FROM faculty';
            filename = 'Faculty_Workload_Report';
            break;

        case 'room-utilization':
            // Pulls specific columns from the rooms table[cite: 5]
            query = 'SELECT room_id, room_type, capacity FROM rooms';
            filename = 'Room_Timetable_Matrix';
            break;

        default:
            return res.status(400).json({ error: 'Invalid report type requested.' });
    }

    try {
        // Execute the query. Note: This assumes your db.js supports promises. 
        // If you get a .promise() error, let me know and we will adjust to callbacks!
        const [rows] = await db.promise().query(query);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No data found for this report.' });
        }

        if (format === 'excel') {
            // Convert database rows to Excel format
            const worksheet = xlsx.utils.json_to_sheet(rows);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Report');

            const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            // Send file to browser for download
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            
            return res.send(excelBuffer);
        } else {
            return res.status(400).json({ error: 'Only excel format is currently supported.' });
        }

    } catch (error) {
        console.error('Export Error:', error);
        res.status(500).json({ error: 'Failed to generate the report.' });
    }
});

module.exports = router;