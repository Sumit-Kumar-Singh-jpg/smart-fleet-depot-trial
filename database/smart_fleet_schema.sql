-- Database for Smart Fleet OS - Depot 44 (Chandapura)
-- Generated from actual data in app_data.js

-- Table for entry checker (person who checks which bus has entered the depot)
CREATE TABLE IF NOT EXISTS entry_checker (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bus_id TEXT NOT NULL,
  reg_no TEXT NOT NULL,
  depot_entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT "Pending",
  checked_by TEXT,
  notes TEXT
);

-- Table for cleaner approval
CREATE TABLE IF NOT EXISTS cleaner_approval (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bus_id TEXT NOT NULL,
  cleaning_status TEXT DEFAULT "Pending",
  cleaned_by TEXT,
  cleaning_time DATETIME,
  inspection_notes TEXT,
  FOREIGN KEY (bus_id) REFERENCES entry_checker(bus_id)
);

-- Table for charging incharge approval
CREATE TABLE IF NOT EXISTS charging_approval (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bus_id TEXT NOT NULL,
  charging_status TEXT DEFAULT "Pending",
  charged_by TEXT,
  charging_time DATETIME,
  charger_bay INTEGER,
  charge_level INTEGER,
  FOREIGN KEY (bus_id) REFERENCES entry_checker(bus_id)
);

-- Table for scheduler (route allocation)
CREATE TABLE IF NOT EXISTS scheduler (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bus_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  schedule_id TEXT,
  driver_name TEXT,
  depot TEXT DEFAULT "Depot 44 (Chandapura)",
  assigned_by TEXT,
  assignment_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT "Assigned",
  FOREIGN KEY (bus_id) REFERENCES entry_checker(bus_id)
);

-- Table for registered drivers and qualifications
CREATE TABLE IF NOT EXISTS drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_name TEXT UNIQUE NOT NULL,
  qualification TEXT DEFAULT 'Standard', -- 'Standard' or 'Senior'
  depot TEXT DEFAULT 'Depot 44 (Chandapura)',
  status TEXT DEFAULT 'Active'
);

-- Insert actual buses from FLEET data as potential depot entries
INSERT OR IGNORE INTO entry_checker (bus_id, reg_no, status, checked_by)
SELECT 'BM221', 'KA51AH8184', 'In Maintenance', 'System' UNION ALL
SELECT 'BM304', 'KA51AJ0137', 'Ready in Depot', 'System' UNION ALL
SELECT 'BM088', 'KA51AH3127', 'Charging (Bay 3)', 'System'UNION ALL
SELECT 'BM057', 'KA51AH2956', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM224', 'KA51AH8185', 'Needs Fast Charge', 'System'UNION ALL
SELECT 'BM218', 'KA51AH8182', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM296', 'KA51AH6779', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM082', 'KA51AH3131', 'Charging (Bay 8)', 'System'UNION ALL
SELECT 'BM012', 'KA51AH2551', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM225', 'KA51AH8349', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM260', 'KA51AH6036', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM288', 'KA51AH7672', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM005', 'KA51AH2421', 'Needs Fast Charge', 'System'UNION ALL
SELECT 'BM185', 'KA51AH5820', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM032', 'KA51AH2739', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM068', 'KA51AH3266', 'Charging (Bay 16)', 'System'UNION ALL
SELECT 'BM004', 'KA51AH2429', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM024', 'KA51AH2619', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM261', 'KA51AH5717', 'Needs Fast Charge', 'System'UNION ALL
SELECT 'BM227', 'KA51AH4544', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM002', 'KA51AH2434', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM119', 'KA51AH4129', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM208', 'KA51AH7775', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM204', 'KA51AH7666', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM038', 'KA51AH2741', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM001', 'KA51AH4144', 'Needs Fast Charge', 'System'UNION ALL
SELECT 'BM010', 'KA51AH2424', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM298', 'KA51AH6778', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM238', 'KA51AH4540', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM003', 'KA51AH2423', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM265', 'KA51AH5723', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM283', 'KA51AH6249', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM086', 'KA51AH3125', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM081', 'KA51AH3129', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM285', 'KA51AH6252', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM116', 'KA51AH4068', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM257', 'KA51AH5648', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM205', 'KA51AH7673', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM183', 'KA51AH5825', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM062', 'KA51AH3269', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM259', 'KA51AH5642', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM075', 'KA51AH3122', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM212', 'KA51AH7779', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM213', 'KA51AH8179', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM245', 'KA51AH4799', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM289', 'KA51AH6471', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM271', 'KA51AH6095', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM207', 'KA51AH7671', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM200', 'KA51AH7659', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM290', 'KA51AH6467', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM210', 'KA51AH8350', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM157', 'KA51AH4800', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM300', 'KA51AH6782', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM199', 'KA51AH7662', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM191', 'KA51AH6038', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM058', 'KA51AH3603', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM278', 'KA51AH6246', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM292', 'KA51AH6468', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM202', 'KA51AH7658', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM220', 'KA51AH8180', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM267', 'KA51AH6034', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM217', 'KA51AH8284', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM174', 'KA51AH5823', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM020', 'KA51AH2556', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM153', 'KA51AH4643', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM277', 'KA51AH6245', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM291', 'KA51AH6466', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM151', 'KA51AH4650', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM295', 'KA51AH6780', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM033', 'KA51AH2740', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM124', 'KA51AH4146', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM275', 'KA51AH6096', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM216', 'KA51AH8281', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM052', 'KA51AH2955', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM054', 'KA51AH2951', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM215', 'KA51AH8346', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM219', 'KA51AH8181', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM198', 'KA51AH7664', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM222', 'KA51AH8183', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM269', 'KA51AH6030', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM187', 'KA51AH5822', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM019', 'KA51AH2552', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM201', 'KA51AH7656', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM206', 'KA51AH7669', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM294', 'KA51AH6777', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM287', 'KA51AH7657', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM107', 'KA51AH4062', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM209', 'KA51AH7668', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM080', 'KA51AH3336', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM268', 'KA51AH6035', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM240', 'KA51AH4789', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM255', 'KA51AH5640', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM276', 'KA51AH6250', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM303', 'KA51AJ0138', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM152', 'KA51AH4652', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM281', 'KA51AH6251', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM274', 'KA51AH6099', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM253', 'KA51AH4987', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM263', 'KA51AH5715', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM279', 'KA51AH6244', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM249', 'KA51AH6029', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM286', 'KA51AH6469', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM193', 'KA51AH7660', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM056', 'KA51AH2953', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM297', 'KA51AH6472', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM214', 'KA51AH8348', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM250', 'KA51AH4801', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM197', 'KA51AH7661', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM284', 'KA51AH6248', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM258', 'KA51AH5643', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM280', 'KA51AH6247', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM203', 'KA51AH7670', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM272', 'KA51AH6097', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM256', 'KA51AH5641', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM282', 'KA51AH7667', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM248', 'KA51AH4797', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM293', 'KA51AH6470', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM299', 'KA51AH7663', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM264', 'KA51AH6037', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM223', 'KA51AH8283', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM239', 'KA51AH4790', 'Ready in Depot', 'System'UNION ALL
SELECT 'BM273', 'KA51AH6098', 'Ready in Depot', 'System';

-- Insert actual schedules data
INSERT OR IGNORE INTO scheduler (bus_id, route_id, status)
SELECT 
SELECT 'BM221', 'SCH-SW-500/14', 'Pending'UNION ALL
SELECT 'BM304', 'SCH-SW-500/15', 'Pending'UNION ALL
SELECT 'BM088', 'SCH-SW-600/16', 'Pending'UNION ALL
SELECT 'BM057', 'SCH-SW-600/17', 'Pending'UNION ALL
SELECT 'BM224', 'SCH-SW-600/21', 'Pending'UNION ALL
SELECT 'BM218', 'SCH-SW-600/26', 'Pending'UNION ALL
SELECT 'BM296', 'SCH-SW-600/27', 'Pending'UNION ALL
SELECT 'BM082', 'SCH-SW-600/3', 'Pending'UNION ALL
SELECT 'BM012', 'SCH-SW-600/42', 'Pending'UNION ALL
SELECT 'BM225', 'SCH-SW-600/43', 'Pending'UNION ALL
SELECT 'BM260', 'SCH-SW-600/45', 'Pending'UNION ALL
SELECT 'BM288', 'SCH-SW/KBS3F/11', 'Pending'UNION ALL
SELECT 'BM005', 'SCH-SW/KBS3F/12', 'Pending'UNION ALL
SELECT 'BM185', 'SCH-SW/KBS3F/13', 'Pending'UNION ALL
SELECT 'BM032', 'SCH-SW/KBS3F/14', 'Pending'UNION ALL
SELECT 'BM068', 'SCH-SW/KBS3F/7', 'Pending'UNION ALL
SELECT 'BM004', 'SCH-SW/KBS3F/8', 'Pending'UNION ALL
SELECT 'BM024', 'SCH-SW-600/31', 'Pending'UNION ALL
SELECT 'BM261', 'SCH-SW-328/2', 'Pending'UNION ALL
SELECT 'BM227', 'SCH-SW-328/6', 'Pending'UNION ALL
SELECT 'BM002', 'SCH-SW-328/10', 'Pending'UNION ALL
SELECT 'BM119', 'SCH-SW-328/13', 'Pending'UNION ALL
SELECT 'BM208', 'SCH-SW-328/16', 'Pending'UNION ALL
SELECT 'BM204', 'SCH-SW-328/20', 'Pending'UNION ALL
SELECT 'BM038', 'SCH-SW-328/22', 'Pending'UNION ALL
SELECT 'BM001', 'SCH-SW-328/23', 'Pending'UNION ALL
SELECT 'BM010', 'SCH-SW-356/6', 'Pending'UNION ALL
SELECT 'BM298', 'SCH-SW-356/7', 'Pending'UNION ALL
SELECT 'BM238', 'SCH-SW-300/2', 'Pending'UNION ALL
SELECT 'BM003', 'SCH-SW-300/20', 'Pending'UNION ALL
SELECT 'BM265', 'SCH-SW-300/23', 'Pending'UNION ALL
SELECT 'BM283', 'SCH-SW-300/25', 'Pending'UNION ALL
SELECT 'BM086', 'SCH-SW-300/26', 'Pending'UNION ALL
SELECT 'BM081', 'SCH-SW-300/32', 'Pending'UNION ALL
SELECT 'BM285', 'SCH-SW-300/34', 'Pending'UNION ALL
SELECT 'BM116', 'SCH-SW-300/35', 'Pending'UNION ALL
SELECT 'BM257', 'SCH-SW-300/36', 'Pending'UNION ALL
SELECT 'BM205', 'SCH-SW-300/40', 'Pending'UNION ALL
SELECT 'BM183', 'SCH-SW-300/43', 'Pending'UNION ALL
SELECT 'BM062', 'SCH-SW-300/46', 'Pending'UNION ALL
SELECT 'BM259', 'SCH-SW-300/61', 'Pending'UNION ALL
SELECT 'BM075', 'SCH-SW-300/66', 'Pending'UNION ALL
SELECT 'BM212', 'SCH-SW-300/73', 'Pending'UNION ALL
SELECT 'BM213', 'SCH-SW-300/77', 'Pending'UNION ALL
SELECT 'BM245', 'SCH-SW-300/78', 'Pending'UNION ALL
SELECT 'BM289', 'SCH-SW-300/79', 'Pending'UNION ALL
SELECT 'BM271', 'SCH-SW-300/8', 'Pending'UNION ALL
SELECT 'BM207', 'SCH-SW-300/80', 'Pending'UNION ALL
SELECT 'BM200', 'SCH-SW-300/9', 'Pending'UNION ALL
SELECT 'BM290', 'SCH-SW-500/12', 'Pending'UNION ALL
SELECT 'BM210', 'SCH-SW-500/13', 'Pending'UNION ALL
SELECT 'BM157', 'SCH-SW-360/10', 'Pending'UNION ALL
SELECT 'BM300', 'SCH-SW-360/11', 'Pending'UNION ALL
SELECT 'BM199', 'SCH-SW-360/12', 'Pending'UNION ALL
SELECT 'BM191', 'SCH-SW-360/20', 'Pending'UNION ALL
SELECT 'BM058', 'SCH-SW-360/26', 'Pending'UNION ALL
SELECT 'BM278', 'SCH-SW-360/33', 'Pending'UNION ALL
SELECT 'BM292', 'SCH-SW-360/34', 'Pending'UNION ALL
SELECT 'BM202', 'SCH-SW-360/5', 'Pending'UNION ALL
SELECT 'BM220', 'SCH-SW-600/32', 'Pending'UNION ALL
SELECT 'BM267', 'SCH-SW-600/49', 'Pending'UNION ALL
SELECT 'BM217', 'SCH-SW-600/5', 'Pending'UNION ALL
SELECT 'BM174', 'SCH-SW-600/51', 'Pending'UNION ALL
SELECT 'BM020', 'SCH-SW-600/52', 'Pending'UNION ALL
SELECT 'BM153', 'SCH-SW-600/53', 'Pending'UNION ALL
SELECT 'BM277', 'SCH-SW-600/53', 'Pending'UNION ALL
SELECT 'BM291', 'SCH-SW-600/57', 'Pending'UNION ALL
SELECT 'BM151', 'SCH-SW-600/6', 'Pending'UNION ALL
SELECT 'BM295', 'SCH-SW-600/66', 'Pending'UNION ALL
SELECT 'BM033', 'SCH-SW-600/66', 'Pending'UNION ALL
SELECT 'BM124', 'SCH-SW-600/67', 'Pending'UNION ALL
SELECT 'BM275', 'SCH-SW-600/68', 'Pending'UNION ALL
SELECT 'BM216', 'SCH-SW-600/69', 'Pending'UNION ALL
SELECT 'BM052', 'SCH-SW-600/72', 'Pending'UNION ALL
SELECT 'BM054', 'SCH-SW-600/74', 'Pending'UNION ALL
SELECT 'BM215', 'SCH-SW-600/75', 'Pending'UNION ALL
SELECT 'BM219', 'SCH-SW-600/78', 'Pending'UNION ALL
SELECT 'BM198', 'SCH-SW-600/79', 'Pending'UNION ALL
SELECT 'BM222', 'SCH-SW-600/8', 'Pending'UNION ALL
SELECT 'BM269', 'SCH-SW-600/80', 'Pending'UNION ALL
SELECT 'BM187', 'SCH-SW-600/80', 'Pending'UNION ALL
SELECT 'BM019', 'SCH-SW-600/81', 'Pending'UNION ALL
SELECT 'BM201', 'SCH-SW-600/91', 'Pending'UNION ALL
SELECT 'BM206', 'SCH-SW-600/92', 'Pending'UNION ALL
SELECT 'BM294', 'SCH-SW-600/93', 'Pending'UNION ALL
SELECT 'BM287', 'SCH-SW-600/94', 'Pending'UNION ALL
SELECT 'BM107', 'SCH-SW-600/95', 'Pending'UNION ALL
SELECT 'BM209', 'SCH-SW-360/15', 'Pending'UNION ALL
SELECT 'BM080', 'SCH-SW-360/3', 'Pending'UNION ALL
SELECT 'BM268', 'SCH-SW-360/30', 'Pending'UNION ALL
SELECT 'BM240', 'SCH-SW/360k/38', 'Pending'UNION ALL
SELECT 'BM255', 'SCH-SW-360/4', 'Pending'UNION ALL
SELECT 'BM276', 'SCH-SW-361/1', 'Pending'UNION ALL
SELECT 'BM303', 'SCH-SW-361/11', 'Pending'UNION ALL
SELECT 'BM152', 'SCH-SW-361/2', 'Pending'UNION ALL
SELECT 'BM281', 'SCH-SW-361/3', 'Pending'UNION ALL
SELECT 'BM274', 'SCH-SW-361/4', 'Pending'UNION ALL
SELECT 'BM253', 'SCH-SW-361/6', 'Pending'UNION ALL
SELECT 'BM263', 'SCH-SW-361/7', 'Pending'UNION ALL
SELECT 'BM279', 'SCH-SW-361/8', 'Pending'UNION ALL
SELECT 'BM249', 'SCH-SW-361/9', 'Pending'UNION ALL
SELECT 'BM286', 'SCH-SW-328/4', 'Pending'UNION ALL
SELECT 'BM193', 'SCH-SW-328/7', 'Pending'UNION ALL
SELECT 'BM056', 'SCH-SW-328/8', 'Pending'UNION ALL
SELECT 'BM297', 'SCH-SW-360/15', 'Pending'UNION ALL
SELECT 'BM214', 'SCH-SW-360/3', 'Pending'UNION ALL
SELECT 'BM250', 'SCH-SW-360/30', 'Pending'UNION ALL
SELECT 'BM197', 'SCH-SW-360/38', 'Pending'UNION ALL
SELECT 'BM284', 'SCH-SW-360/4', 'Pending'UNION ALL
SELECT 'BM258', 'SCH-SW-399/5', 'Pending'UNION ALL
SELECT 'BM280', 'SCH-SW-399/6', 'Pending'UNION ALL
SELECT 'BM203', 'SCH-SW-356/3', 'Pending'UNION ALL
SELECT 'BM272', 'SCH-SW-356/6', 'Pending'UNION ALL
SELECT 'BM256', 'SCH-SW-356/7', 'Pending'UNION ALL
SELECT 'BM282', 'SCH-SW-356/8', 'Pending'UNION ALL
SELECT 'BM248', 'SCH-SW-399/3', 'Pending'UNION ALL
SELECT 'BM293', 'SCH-SW-399/4', 'Pending'UNION ALL
SELECT 'BM299', 'SCH-SW-328/1', 'Pending'UNION ALL
SELECT 'BM264', 'SCH-SW-328/12', 'Pending'UNION ALL
SELECT 'BM223', 'SCH-SW-328/14', 'Pending'UNION ALL
SELECT 'BM239', 'SCH-SW-328/19', 'Pending'UNION ALL
SELECT 'BM273', 'SCH-SW-328/21', 'Pending'UNION ALL
SELECT 'BM221', 'SCH-SW-328/25', 'Pending'UNION ALL
SELECT 'BM304', 'SCH-SW-328/28', 'Pending'UNION ALL
SELECT 'BM088', 'SCH-SW-328/3', 'Pending'UNION ALL
SELECT 'BM057', 'SCH-SW-328/9', 'Pending'UNION ALL
SELECT 'BM224', 'SCH-SW/KBS3F/15', 'Pending'UNION ALL
SELECT 'BM218', 'SCH-SW/KBS3F/16', 'Pending'UNION ALL
SELECT 'BM296', 'SCH-SW/KBS3F/17', 'Pending'UNION ALL
SELECT 'BM082', 'SCH-SW/KBS3F/18', 'Pending';

-- Insert actual routes data for reference
CREATE TABLE IF NOT EXISTS routes_reference (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  color TEXT,
  distance REAL,
  dailyKm INTEGER,
  stops INTEGER,
  buses INTEGER,
  trips INTEGER
);
INSERT OR IGNORE INTO routes_reference (id, name, category, color, distance, dailyKm, stops, buses, trips)
SELECT 
SELECT 'SW-328', 'Attibele - Hosakote Industrial Corridor', 'Complex', '#1E3A8A', 34.6, 291.4, 28, 10, 24UNION ALL
SELECT 'SW-600', 'Banashankari - Chandapura Express Trunk', 'Moderate', '#3B82F6', 28.7, 157.9, 34, 13, 310UNION ALL
SELECT 'SW-360', 'Central Hub - Attibele Concession Trunk', 'Complex', '#1E293B', 34.2, 188.5, 38, 35, 104UNION ALL
SELECT 'SW-300', 'Central Express - Attibele Fast Transit', 'Moderate', '#94A3B8', 34.2, 168, 36, 4, 146UNION ALL
SELECT 'SW-500', 'Outer Ring Road - Chandapura Concession', 'Complex', '#0F172A', 42.8, 188.5, 42, 9, 90UNION ALL
SELECT 'SW-356', 'Anekal - Chandapura Tech Feeder', 'Simple', '#60A5FA', 15.2, 188.5, 18, 21, 200UNION ALL
SELECT 'SW-361', 'City Market - Anekal Radial Link', 'Moderate', '#64748B', 37.8, 160.2, 32, 4, 88UNION ALL
SELECT 'SW-399', 'Bannerghatta - Jigani Industrial Spur', 'Simple', '#475569', 28.5, 142.5, 24, 4, 32;
