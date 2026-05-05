import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Check, X, LogOut, Activity, Info, ChevronRight, ChevronLeft, History, Moon, Clock, Download, Calendar, Filter, Users, MapPin, Upload, FileText, Trash2, Eye, Edit } from 'lucide-react';

export default function App() {
  const coachName = 'Coach';
  const [students, setStudents] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);
  
  // Pending Attendance state for bulk marking
  const [pendingAttendance, setPendingAttendance] = useState({});
  const [isAlreadyMarked, setIsAlreadyMarked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const selectedSport = 'Basketball';
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [session, setSession] = useState('Morning');
  const [sessionTime, setSessionTime] = useState('');
  
  // New States for School & Centre Grouping & History Explorer
  const [currentView, setCurrentView] = useState('marking'); // 'marking' | 'explorer'
  const [selectedSchool, setSelectedSchool] = useState('All Schools');
  const [selectedCentre, setSelectedCentre] = useState('All Centres');
  const [explorerStudent, setExplorerStudent] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [schools, setSchools] = useState([]);
  const [centres, setCentres] = useState([]);
  
  const [showAddSchoolModal, setShowAddSchoolModal] = useState(false);
  const [showAddCentreModal, setShowAddCentreModal] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newCentreName, setNewCentreName] = useState('');
  
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Form State
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentAge, setNewStudentAge] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [newStudentAddress, setNewStudentAddress] = useState('');
  const [newStudentSchool, setNewStudentSchool] = useState('');
  const [newStudentCentre, setNewStudentCentre] = useState('');
  const [newStudentSerial, setNewStudentSerial] = useState('');
  const [newStudentParentName, setNewStudentParentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentJoiningDate, setNewStudentJoiningDate] = useState('');
  const [newStudentSchoolIdNumber, setNewStudentSchoolIdNumber] = useState('');
  const [newStudentAadhaar, setNewStudentAadhaar] = useState('');
  const [newStudentSchoolIdFile, setNewStudentSchoolIdFile] = useState(null);
  const [newStudentAadhaarFrontFile, setNewStudentAadhaarFrontFile] = useState(null);
  const [newStudentAadhaarBackFile, setNewStudentAadhaarBackFile] = useState(null);

  // Edit Mode State
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);

  // Info Modal State
  const [selectedStudentInfo, setSelectedStudentInfo] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Profile Modal State
  const [profileTab, setProfileTab] = useState('info'); // 'info', 'documents', 'history'
  const [studentDocuments, setStudentDocuments] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadType, setUploadType] = useState('ID Proof');
  
  // History State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [studentHistory, setStudentHistory] = useState([]);
  const [explorerHistory, setExplorerHistory] = useState([]);

  const fileInputRef = useRef(null);

  const fetchData = async () => {
    try {
      const schoolParam = selectedSchool === 'All Schools' ? '' : `&school=${encodeURIComponent(selectedSchool)}`;
      const centreParam = selectedCentre === 'All Centres' ? '' : `&centre_id=${encodeURIComponent(selectedCentre)}`;
      const resStudents = await fetch(`/api/students?sport=${selectedSport}${schoolParam}${centreParam}`);
      const dataStudents = await resStudents.json();
      
      const centreQuery = selectedCentre === 'All Centres' ? '' : `&centre_id=${encodeURIComponent(selectedCentre)}`;
      const resAttendance = await fetch(`/api/attendance?date=${attendanceDate}&session=${session}&session_time=${sessionTime}${centreQuery}`);
      const dataAttendance = await resAttendance.json();

      const mergedStudents = (dataStudents || []).map(s => {
        const record = (dataAttendance || []).find(a => a.student_id === s.id);
        return {
          ...s,
          currentStatus: record ? record.status : null
        };
      });
      setStudents(mergedStudents);

      const initialPending = {};
      let marked = false;
      (dataAttendance || []).forEach(a => {
        initialPending[a.student_id] = a.status;
        marked = true;
      });
      setPendingAttendance(initialPending);
      setIsAlreadyMarked(marked);
      setIsEditing(!marked);

      const resRecent = await fetch('/api/attendance');
      const dataRecent = await resRecent.json();
      setRecentAttendance((dataRecent || []).slice(0, 10));

      const resSchools = await fetch('/api/schools');
      const dataSchools = await resSchools.json();
      setSchools(dataSchools || []);
      
      const resCentres = await fetch('/api/centres');
      const dataCentres = await resCentres.json();
      setCentres(dataCentres || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    const fetchExplorerData = async () => {
      if (!explorerStudent) return;
      try {
        const res = await fetch(`/api/attendance/student/${explorerStudent.id}`);
        const data = await res.json();
        setExplorerHistory(data || []);
      } catch (err) {
        console.error('Failed to fetch explorer history');
      }
    };
    fetchExplorerData();
  }, [explorerStudent]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'soft');
    fetchData();
    
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [attendanceDate, session, sessionTime, selectedSchool, selectedCentre]);

  const addSchool = async (e) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;
    try {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSchoolName })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        setNewSchoolName('');
        setShowAddSchoolModal(false);
        fetchData();
      }
    } catch (err) { alert('Failed to add school'); }
  };
  
  const addCentre = async (e) => {
    e.preventDefault();
    if (!newCentreName.trim()) return;
    try {
      const res = await fetch('/api/centres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCentreName })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        setNewCentreName('');
        setShowAddCentreModal(false);
        fetchData();
      }
    } catch (err) { alert('Failed to add centre'); }
  };


  const openStudentInfo = async (student) => {
    setSelectedStudentInfo(student);
    setProfileTab('info');
    try {
      const resHist = await fetch(`/api/attendance/student/${student.id}`);
      const dataHist = await resHist.json();
      setStudentHistory(dataHist);
      
      const resDocs = await fetch(`/api/students/${student.id}/documents`);
      const dataDocs = await resDocs.json();
      setStudentDocuments(dataDocs);
    } catch (err) {
      console.error('Failed to fetch student details');
    }
  };

  const resetStudentForm = () => {
    setNewStudentName('');
    setNewStudentAge('');
    setNewStudentPhone('');
    setNewStudentAddress('');
    setNewStudentSchool('');
    setNewStudentCentre('');
    setNewStudentSerial('');
    setNewStudentParentName('');
    setNewStudentEmail('');
    setNewStudentJoiningDate('');
    setNewStudentSchoolIdNumber('');
    setNewStudentAadhaar('');
    setNewStudentSchoolIdFile(null);
    setNewStudentAadhaarFrontFile(null);
    setNewStudentAadhaarBackFile(null);
    setIsEditMode(false);
    setEditingStudentId(null);
  };

  const openEditModal = (student) => {
    setNewStudentName(student.name || '');
    setNewStudentAge(student.age || '');
    setNewStudentPhone(student.phone || '');
    setNewStudentAddress(student.address || '');
    setNewStudentSchool(student.school || '');
    setNewStudentCentre(student.centre_id || '');
    setNewStudentSerial(student.serial_number || '');
    setNewStudentParentName(student.parent_name || '');
    setNewStudentEmail(student.email || '');
    setNewStudentJoiningDate(student.joining_date || '');
    setNewStudentSchoolIdNumber(student.school_id_number || '');
    setNewStudentAadhaar(student.aadhaar_number || '');
    
    setIsEditMode(true);
    setEditingStudentId(student.id);
    setSelectedStudentInfo(null);
    setShowAddModal(true);
  };

  const submitStudentForm = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;

    if (newStudentAadhaar && !/^\d{12}$/.test(newStudentAadhaar)) {
      alert("Aadhaar Number must be exactly 12 numeric digits.");
      return;
    }

    const payload = { 
      name: newStudentName, 
      sport: selectedSport,
      age: newStudentAge ? parseInt(newStudentAge) : null,
      phone: newStudentPhone,
      address: newStudentAddress,
      school: newStudentSchool,
      centre_id: newStudentCentre,
      serial_number: newStudentSerial,
      parent_name: newStudentParentName,
      email: newStudentEmail,
      joining_date: newStudentJoiningDate,
      school_id_number: newStudentSchoolIdNumber,
      aadhaar_number: newStudentAadhaar
    };

    try {
      let studentId;
      if (isEditMode && editingStudentId) {
        await fetch(`/api/students/${editingStudentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        studentId = editingStudentId;
      } else {
        const res = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        studentId = data.id;
      }

      const uploadDoc = async (file, type) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('document', file);
        formData.append('document_type', type);
        await fetch(`/api/students/${studentId}/documents`, { method: 'POST', body: formData });
      };

      await uploadDoc(newStudentSchoolIdFile, 'School ID Image');
      await uploadDoc(newStudentAadhaarFrontFile, 'Aadhaar Card (Front)');
      await uploadDoc(newStudentAadhaarBackFile, 'Aadhaar Card (Back)');

      resetStudentForm();
      setShowAddModal(false);
      fetchData();
    } catch (err) {
      alert('Failed to save student');
    }
  };

  const deleteStudent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSelectedStudentInfo(null);
        fetchData();
      }
    } catch (err) { alert('Failed to delete student'); }
  };
  
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile || !selectedStudentInfo) return;
    
    const formData = new FormData();
    formData.append('document', uploadFile);
    formData.append('document_type', uploadType);
    
    try {
      const res = await fetch(`/api/students/${selectedStudentInfo.id}/documents`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        setUploadFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        const resDocs = await fetch(`/api/students/${selectedStudentInfo.id}/documents`);
        const dataDocs = await resDocs.json();
        setStudentDocuments(dataDocs);
      }
    } catch (err) { alert('Upload failed'); }
  };
  
  const deleteDocument = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      const res = await fetch(`/api/students/${selectedStudentInfo.id}/documents/${docId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setStudentDocuments(prev => prev.filter(d => d.id !== docId));
      }
    } catch (err) { alert('Failed to delete document'); }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data);
    } catch (err) { console.error('Failed to fetch history'); }
  };

  const markAttendanceLocally = (studentId, status) => {
    setPendingAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const submitBulkAttendance = async () => {
    if (!coachName.trim()) {
      alert('Please enter coach name before submitting.');
      return;
    }

    if (isAlreadyMarked && !window.confirm('Attendance already marked for this session. Do you want to update it?')) {
      return;
    }

    const records = Object.entries(pendingAttendance).map(([id, status]) => ({
      student_id: parseInt(id),
      status
    }));

    if (records.length === 0) {
      alert('Please mark attendance for at least one student.');
      return;
    }

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records,
          date: attendanceDate,
          session,
          session_time: sessionTime,
          coach_name: coachName,
          centre_id: selectedCentre !== 'All Centres' ? selectedCentre : null
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Attendance submitted successfully!');
        setAttendanceDate(new Date().toISOString().split('T')[0]);
        setSession('Morning');
        setSessionTime('');
        setPendingAttendance({});
        setSearchQuery('');
        setIsEditing(true); 
        fetchData();
      }
    } catch (err) { alert('Failed to submit attendance'); }
  };

  const filteredStudents = (students || []).filter(s => {
    if (!s) return false;
    const name = (s.name || '').toLowerCase();
    const id = String(s.student_id || '').toLowerCase();
    const serial = String(s.serial_number || '').toLowerCase();
    const query = (searchQuery || '').toLowerCase();
    return name.includes(query) || id.includes(query) || serial.includes(query);
  });
  
  const maskAadhaar = (aadhaar) => {
    if (!aadhaar || aadhaar.length !== 12) return 'N/A';
    return `XXXX-XXXX-${aadhaar.slice(-4)}`;
  };


  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main className="main-content">
          <header style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h1 style={{ margin:0, fontSize:'1.25rem', fontWeight:700 }}>Hi5 Youth Foundation</h1>
              <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                <button onClick={() => { fetchHistory(); setShowHistoryModal(true); }} className="btn-icon" title="History"><Clock size={20} /></button>
              </div>
            </div>

            <div style={{ display:'flex', background:'var(--bg-alt)', borderRadius:'10px', padding:'4px', gap:'4px' }}>
              <button onClick={() => setCurrentView('marking')} className={`tab-btn ${currentView==='marking'?'active':''}`} style={{ flex:1 }}>Mark Attendance</button>
              <button onClick={() => setCurrentView('explorer')} className={`tab-btn ${currentView==='explorer'?'active':''}`} style={{ flex:1 }}>History Explorer</button>
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', flexWrap:'wrap' }}>
              {/* Centre Filter */}
              <div style={{ display:'flex', alignItems:'center', gap:'6px', flex:1, minWidth:'140px', background:'var(--surface-color)', border:'1px solid var(--border-color)', borderRadius:'10px', padding:'7px 10px' }}>
                <MapPin size={16} style={{ color:'var(--text-secondary)', flexShrink:0 }} />
                <select
                  value={selectedCentre}
                  onChange={e => setSelectedCentre(e.target.value)}
                  style={{ flex:1, border:'none', background:'transparent', padding:0, fontSize:'0.9rem', color:'var(--text-primary)', outline:'none' }}
                >
                  <option value="All Centres">All Centres</option>
                  {(centres||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => setShowAddCentreModal(true)} style={{ background:'transparent', border:'none', padding:'2px', color:'var(--accent-color)', cursor:'pointer', display:'flex', alignItems:'center' }}><Plus size={16} /></button>
              </div>
              
              {/* School Filter */}
              <div style={{ display:'flex', alignItems:'center', gap:'6px', flex:1, minWidth:'140px', background:'var(--surface-color)', border:'1px solid var(--border-color)', borderRadius:'10px', padding:'7px 10px' }}>
                <Users size={16} style={{ color:'var(--text-secondary)', flexShrink:0 }} />
                <select
                  value={selectedSchool}
                  onChange={e => setSelectedSchool(e.target.value)}
                  style={{ flex:1, border:'none', background:'transparent', padding:0, fontSize:'0.9rem', color:'var(--text-primary)', outline:'none' }}
                >
                  <option>All Schools</option>
                  {(schools||[]).map(school => <option key={school.id} value={school.name}>{school.name}</option>)}
                </select>
                <button onClick={() => setShowAddSchoolModal(true)} style={{ background:'transparent', border:'none', padding:'2px', color:'var(--accent-color)', cursor:'pointer', display:'flex', alignItems:'center' }}><Plus size={16} /></button>
              </div>
              
              <button onClick={() => { resetStudentForm(); setShowAddModal(true); }} className="btn-primary add-btn" style={{ minWidth:'140px' }}><Plus size={18} /> Add Student</button>
            </div>

          </header>

        {currentView === 'marking' ? (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px' }}>

              <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'#FFFBF5', border:'1px solid var(--border-color)', borderRadius:'12px', padding:'11px 14px' }}>
                <Search size={18} style={{ color:'var(--text-secondary)', flexShrink:0 }} />
                <input
                  type="text"
                  placeholder="Search name, ID or serial..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ border:'none', background:'transparent', padding:0, flex:1, outline:'none', fontSize:'0.95rem', color:'var(--text-primary)' }}
                />
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'#FFFBF5', border:'1px solid var(--border-color)', borderRadius:'12px', padding:'11px 14px' }}>
                  <Calendar size={18} style={{ color:'var(--text-secondary)', flexShrink:0 }} />
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={e => setAttendanceDate(e.target.value)}
                    style={{ border:'none', background:'transparent', padding:0, flex:1, fontSize:'0.9rem', color:'var(--text-primary)', outline:'none' }}
                  />
                  <button
                    onClick={() => { setAttendanceDate(new Date().toISOString().split('T')[0]); setSession('Morning'); setSessionTime(''); setIsEditing(true); }}
                    style={{ background:'transparent', border:'none', fontSize:'0.8rem', color:'var(--accent-color)', padding:'2px 8px', cursor:'pointer', fontWeight:600, flexShrink:0, borderRadius:'6px' }}
                  >Today</button>
                </div>

                <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'#FFFBF5', border:'1px solid var(--border-color)', borderRadius:'12px', padding:'11px 14px' }}>
                  <Clock size={18} style={{ color:'var(--text-secondary)', flexShrink:0 }} />
                  <select
                    value={session}
                    onChange={e => setSession(e.target.value)}
                    style={{ border:'none', background:'transparent', padding:0, fontSize:'0.9rem', flex:1, color:'var(--text-primary)', outline:'none' }}
                  >
                    <option>Morning</option>
                    <option>Afternoon</option>
                    <option>Evening</option>
                    <option>Match</option>
                  </select>
                  <div style={{ width:'1px', height:'18px', background:'var(--border-color)', flexShrink:0 }} />
                  <input
                    type="time"
                    value={sessionTime}
                    onChange={e => setSessionTime(e.target.value)}
                    style={{ border:'none', background:'transparent', padding:0, fontSize:'0.9rem', flex:1, minWidth:'85px', color:'var(--text-primary)', outline:'none' }}
                  />
                </div>
              </div>

            </div>

            <div style={{ border:'none', background:'transparent', boxShadow:'none' }}>
              <div className="attendance-list-compact">
                {!filteredStudents || filteredStudents.length === 0 ? (
                  <div style={{ textAlign:'center', paddingTop:'60px', paddingBottom:'32px', color:'var(--text-secondary)', opacity:0.55, fontSize:'0.9rem', letterSpacing:'0.01em' }}>No students found.</div>
                ) : (
                  filteredStudents.map(student => (
                    <div 
                      key={student.id} 
                      className={`attendance-row ${pendingAttendance[student.id] === 'Present' ? 'marked-present' : ''} ${pendingAttendance[student.id] === 'Absent' ? 'marked-absent' : ''}`}
                    >
                      <div className="student-info-compact" onClick={() => openStudentInfo(student)}>
                        <div className="avatar" style={{ width: 34, height: 34, fontSize: '0.8rem' }}>
                          {(student.name || '?').substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="student-name-text">
                            {student.serial_number && <span className="serial-tag">#{student.serial_number}</span>}
                            {student.name}
                          </div>
                          <div className="student-school-tag">
                            {student.centre_name ? `${student.centre_name} • ` : ''}{student.school || 'No Team'}
                          </div>
                        </div>
                      </div>

                      <div className="pa-toggle">
                        <button 
                          className={`btn-pa ${pendingAttendance[student.id] === 'Present' ? 'active-p' : ''}`}
                          onClick={() => markAttendanceLocally(student.id, 'Present')}
                          disabled={!isEditing}
                        >P</button>
                        <button 
                          className={`btn-pa ${pendingAttendance[student.id] === 'Absent' ? 'active-a' : ''}`}
                          onClick={() => markAttendanceLocally(student.id, 'Absent')}
                          disabled={!isEditing}
                        >A</button>
                        
                        {/* Added quick edit button */}
                        <button 
                          className="btn-icon" 
                          onClick={() => openEditModal(student)}
                          style={{ padding: '4px', marginLeft: '4px' }}
                          title="Edit"
                        ><Edit size={16} color="var(--text-secondary)" /></button>
                        
                        <button 
                          className="btn-icon" 
                          onClick={() => openStudentInfo(student)}
                          style={{ padding: '4px' }}
                          title="Profile"
                        ><Info size={18} color="var(--text-secondary)" /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {filteredStudents.length > 0 && isEditing && (
              <div className="fixed-submit-bar">
                <button 
                  className="btn-primary" 
                  onClick={submitBulkAttendance}
                  style={{ width: '100%', maxWidth: '400px', height: '50px', fontSize: '1.1rem' }}
                >
                  Submit Attendance
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="history-explorer">
            <div className="flex gap-4 mb-6 explorer-header">
              <div className="flex-1 info-item">
                <label className="text-sm font-bold mb-2">Select Student</label>
                <select className="w-full" value={explorerStudent?.id || ''} onChange={e => setExplorerStudent(students.find(st => st.id === parseInt(e.target.value)))}>
                  <option value="">Choose a student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school || 'No School'})</option>)}
                </select>
              </div>
              <div className="info-item">
                <label className="text-sm font-bold mb-2">From</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="info-item">
                <label className="text-sm font-bold mb-2">To</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            {explorerStudent ? (
              <div className="card p-6 explorer-content">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{explorerStudent.name}</h2>
                    <p className="text-secondary">{explorerStudent.school || 'No School'} • {explorerStudent.sport}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-3xl font-bold text-accent">{explorerStudent.percentage}%</div>
                      <div className="text-xs text-secondary uppercase tracking-wider">Attendance</div>
                    </div>
                  </div>
                </div>

                <div className="student-history-list" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {explorerHistory.length === 0 ? (
                    <p className="text-center py-12 text-secondary">No records found for this period.</p>
                  ) : (
                    explorerHistory.map((rec, i) => (
                      <div key={i} className="flex justify-between items-center py-4 border-bottom" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-sm">{rec.date}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-white" style={{ fontSize: '0.65rem' }}>{rec.session}</span>
                          </div>
                          <div className="text-xs text-secondary mt-1 flex gap-4">
                            {rec.session_time && <span>🕒 {rec.session_time}</span>}
                            <span>Coach: {rec.marked_by}</span>
                          </div>
                        </div>
                        <div className={`badge ${rec.status === 'Present' ? 'regular' : 'low'}`}>{rec.status}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-24 card opacity-50">
                <Calendar size={64} className="mx-auto mb-4 text-secondary" />
                <p>Select a student to view their complete history.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Profile Modal */}
      {selectedStudentInfo && (
        <div className="modal-overlay" onClick={() => setSelectedStudentInfo(null)}>
          <div className="modal-content profile-modal scrollable-modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="avatar" style={{ width: 48, height: 48, fontSize: '1.2rem' }}>
                  {(selectedStudentInfo.name || '?').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', display:'flex', alignItems:'center', gap:'6px' }}>
                    {selectedStudentInfo.name}
                    {selectedStudentInfo.serial_number && <span className="serial-badge">#{selectedStudentInfo.serial_number}</span>}
                  </h2>
                  <p className="text-secondary">{selectedStudentInfo.student_id} • {selectedStudentInfo.sport}</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setSelectedStudentInfo(null)}><X size={20}/></button>
            </div>
            
            {/* Profile Tabs */}
            <div className="profile-tabs mb-4">
              <button className={`tab-btn ${profileTab === 'info' ? 'active' : ''}`} onClick={() => setProfileTab('info')}>Basic Info</button>
              <button className={`tab-btn ${profileTab === 'documents' ? 'active' : ''}`} onClick={() => setProfileTab('documents')}>Documents</button>
              <button className={`tab-btn ${profileTab === 'history' ? 'active' : ''}`} onClick={() => setProfileTab('history')}>History</button>
            </div>

            <div className="profile-tab-content">
              {profileTab === 'info' && (
                <div className="profile-info-sections">
                  
                  <div className="info-section mb-4">
                    <h3 className="section-title text-sm font-bold text-accent mb-2">Basic Information</h3>
                    <div className="info-grid mt-0">
                      <div className="info-item"><span className="text-secondary text-xs font-medium">Name</span><span className="text-sm">{selectedStudentInfo.name}</span></div>
                      <div className="info-item"><span className="text-secondary text-xs font-medium">Age</span><span className="text-sm">{selectedStudentInfo.age || 'N/A'}</span></div>
                      <div className="info-item"><span className="text-secondary text-xs font-medium">Joining Date</span><span className="text-sm">{selectedStudentInfo.joining_date || 'N/A'}</span></div>
                    </div>
                  </div>

                  <div className="info-section mb-4">
                    <h3 className="section-title text-sm font-bold text-accent mb-2">Identity Details</h3>
                    <div className="info-grid mt-0">
                      <div className="info-item"><span className="text-secondary text-xs font-medium">School ID Number</span><span className="text-sm">{selectedStudentInfo.school_id_number || 'N/A'}</span></div>
                      <div className="info-item"><span className="text-secondary text-xs font-medium">Aadhaar Number</span><span className="text-sm">{maskAadhaar(selectedStudentInfo.aadhaar_number)}</span></div>
                    </div>
                  </div>

                  <div className="info-section mb-4">
                    <h3 className="section-title text-sm font-bold text-accent mb-2">Centre & Sports Details</h3>
                    <div className="info-grid mt-0">
                      <div className="info-item"><span className="text-secondary text-xs font-medium">Centre</span><span className="text-sm">{selectedStudentInfo.centre_name || 'N/A'}</span></div>
                      <div className="info-item"><span className="text-secondary text-xs font-medium">School / Team</span><span className="text-sm">{selectedStudentInfo.school || 'N/A'}</span></div>
                      <div className="info-item"><span className="text-secondary text-xs font-medium">Sport</span><span className="text-sm">{selectedStudentInfo.sport}</span></div>
                    </div>
                  </div>

                  <div className="info-section mb-4">
                    <h3 className="section-title text-sm font-bold text-accent mb-2">Contact Information</h3>
                    <div className="info-grid mt-0">
                      <div className="info-item"><span className="text-secondary text-xs font-medium">Parent Name</span><span className="text-sm">{selectedStudentInfo.parent_name || 'N/A'}</span></div>
                      <div className="info-item"><span className="text-secondary text-xs font-medium">Phone</span><span className="text-sm">{selectedStudentInfo.phone || 'N/A'}</span></div>
                      <div className="info-item"><span className="text-secondary text-xs font-medium">Email</span><span className="text-sm">{selectedStudentInfo.email || 'N/A'}</span></div>
                      <div className="info-item" style={{ gridColumn: '1 / -1' }}><span className="text-secondary text-xs font-medium">Address</span><span className="text-sm">{selectedStudentInfo.address || 'N/A'}</span></div>
                    </div>
                  </div>

                  <div className="info-section mb-4">
                    <h3 className="section-title text-sm font-bold text-accent mb-2">Attendance Summary</h3>
                    <div className="info-grid mt-0">
                      <div className="info-item"><span className="text-secondary text-xs font-medium">Status</span><span className={`badge ${(selectedStudentInfo.health || '').toLowerCase()}`}>{selectedStudentInfo.health} ({selectedStudentInfo.percentage}%)</span></div>
                      <div className="info-item"><span className="text-secondary text-xs font-medium">Total Classes</span><span className="text-sm">{selectedStudentInfo.total_classes || 0}</span></div>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-4 flex gap-3" style={{ borderTop:'1px solid var(--border-color)' }}>
                    <button className="btn-primary flex-1 py-3" onClick={() => openEditModal(selectedStudentInfo)}><Edit size={16} /> Edit Profile</button>
                    <button className="btn-danger flex-1 py-3" onClick={() => deleteStudent(selectedStudentInfo.id)}><Trash2 size={16} /> Delete Student</button>
                  </div>
                </div>
              )}

              {profileTab === 'documents' && (
                <div className="documents-section">
                  <div className="upload-box p-4 border rounded-lg mb-4 bg-gray-50">
                    <h4 className="text-sm font-bold mb-2">Upload New Document</h4>
                    <form onSubmit={handleFileUpload} className="flex flex-col gap-2">
                      <select value={uploadType} onChange={e => setUploadType(e.target.value)} className="w-full text-sm p-2 border rounded">
                        <option value="ID Proof">ID Proof</option>
                        <option value="Aadhaar Card (Front)">Aadhaar Card (Front)</option>
                        <option value="Aadhaar Card (Back)">Aadhaar Card (Back)</option>
                        <option value="School ID Image">School ID Image</option>
                        <option value="Medical Certificate">Medical Certificate</option>
                        <option value="Photo">Photo</option>
                        <option value="Other">Other</option>
                      </select>

                      {!uploadFile ? (
                        <div className="flex gap-2 mt-2">
                          <label className="btn-ghost flex-1 text-center py-2 border rounded cursor-pointer text-sm font-medium flex items-center justify-center gap-1 bg-white">
                            <span style={{ fontSize: '1.2rem' }}>📁</span> Choose File
                            <input type="file" ref={fileInputRef} onChange={e => setUploadFile(e.target.files[0])} accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }} />
                          </label>
                          <label className="btn-ghost flex-1 text-center py-2 border rounded cursor-pointer text-sm font-medium flex items-center justify-center gap-1 bg-white">
                            <span style={{ fontSize: '1.2rem' }}>📷</span> Camera
                            <input type="file" onChange={e => setUploadFile(e.target.files[0])} accept="image/*" capture="environment" style={{ display: 'none' }} />
                          </label>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2 bg-white border rounded mt-2">
                          <span className="text-sm truncate mr-2 font-medium" style={{ maxWidth: '200px' }}>{uploadFile.name}</span>
                          <button type="button" onClick={() => {
                            setUploadFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }} className="btn-icon p-1 border" style={{ color: 'var(--danger-color)', borderColor: 'var(--border-color)' }} title="Remove selection"><X size={14}/></button>
                        </div>
                      )}

                      <button type="submit" disabled={!uploadFile} className="btn-primary py-2 mt-2 flex items-center justify-center gap-2">
                        <Upload size={16} /> Upload Document
                      </button>
                    </form>
                  </div>
                  
                  <div className="documents-list">
                    <h4 className="text-sm font-bold mb-2">Uploaded Documents ({studentDocuments.length})</h4>
                    {studentDocuments.length === 0 ? (
                      <p className="text-sm text-secondary text-center py-4">No documents uploaded.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {studentDocuments.map(doc => (
                          <div key={doc.id} className="flex justify-between items-center p-3 border rounded bg-white">
                            <div className="flex items-center gap-3">
                              {doc.file_name.match(/\.(jpg|jpeg|png)$/i) ? (
                                <img src={`/uploads/${doc.file_name}`} alt="Thumbnail" className="doc-thumbnail flex-shrink-0" />
                              ) : (
                                <FileText size={20} className="text-accent flex-shrink-0" />
                              )}
                              <div style={{ minWidth: 0 }}>
                                <div className="text-sm font-bold truncate" title={doc.original_name}>{doc.original_name}</div>
                                <div className="text-xs text-secondary">{doc.document_type} • {new Date(doc.uploaded_at).toLocaleDateString()}</div>
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <a href={`/uploads/${doc.file_name}`} target="_blank" rel="noreferrer" className="btn-ghost p-2 rounded" title="Preview"><Eye size={16} /></a>
                              <a href={`/uploads/${doc.file_name}`} download={doc.original_name} className="btn-ghost p-2 rounded" title="Download"><Download size={16} /></a>
                              <button onClick={() => deleteDocument(doc.id)} className="btn-danger p-2 rounded" title="Delete"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {profileTab === 'history' && (
                <div className="student-history-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {studentHistory.length === 0 ? (
                    <p className="text-center py-8 text-secondary">No attendance records.</p>
                  ) : (
                    studentHistory.map((rec, i) => (
                      <div key={i} className="flex justify-between items-center py-3 border-bottom" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <div>
                          <div className="font-bold text-sm">{rec.date}</div>
                          <div className="text-xs text-secondary">{rec.session}</div>
                        </div>
                        <div className={`badge ${rec.status === 'Present' ? 'regular' : 'low'}`}>{rec.status}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); resetStudentForm(); }}>
          <div className="modal-content form-modal scrollable-modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="m-0 text-xl font-bold">{isEditMode ? 'Edit Student Profile' : 'Add New Student'}</h2>
              <button className="btn-icon" onClick={() => { setShowAddModal(false); resetStudentForm(); }}><X size={20}/></button>
            </div>
            <form onSubmit={submitStudentForm} className="flex flex-col gap-6">
              
              <div className="form-section">
                <h3 className="section-title text-sm font-bold text-accent mb-3 uppercase tracking-wider">Basic Information</h3>
                <div className="form-grid">
                  <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                    <label className="text-xs text-secondary font-medium">Full Name *</label>
                    <input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} required />
                  </div>
                  <div className="info-item">
                    <label className="text-xs text-secondary font-medium">Age</label>
                    <input type="number" value={newStudentAge} onChange={e => setNewStudentAge(e.target.value)} />
                  </div>
                  <div className="info-item">
                    <label className="text-xs text-secondary font-medium">Joining Date</label>
                    <input type="date" value={newStudentJoiningDate} onChange={e => setNewStudentJoiningDate(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3 className="section-title text-sm font-bold text-accent mb-3 uppercase tracking-wider">Identity Details</h3>
                <div className="form-grid">
                  <div className="info-item">
                    <label className="text-xs text-secondary font-medium">School ID Number</label>
                    <input type="text" value={newStudentSchoolIdNumber} onChange={e => setNewStudentSchoolIdNumber(e.target.value)} placeholder="e.g. SCH-123" />
                  </div>
                  <div className="info-item">
                    <label className="text-xs text-secondary font-medium">Aadhaar Number</label>
                    <input type="text" value={newStudentAadhaar} onChange={e => setNewStudentAadhaar(e.target.value)} placeholder="12-digit number" maxLength={12} />
                  </div>
                  
                  <div className="info-item">
                    <label className="text-xs text-secondary font-medium">Upload School ID Image</label>
                    <div className="flex gap-1 mt-1">
                      <label className="btn-ghost flex-1 text-center py-2 border rounded cursor-pointer text-xs flex items-center justify-center bg-white" style={{ borderColor: 'var(--border-color)' }}>
                        <span>📁 File</span>
                        <input type="file" onChange={e => setNewStudentSchoolIdFile(e.target.files[0])} accept="image/*,.pdf" style={{ display: 'none' }} />
                      </label>
                      <label className="btn-ghost flex-1 text-center py-2 border rounded cursor-pointer text-xs flex items-center justify-center bg-white" style={{ borderColor: 'var(--border-color)' }}>
                        <span>📷 Cam</span>
                        <input type="file" onChange={e => setNewStudentSchoolIdFile(e.target.files[0])} accept="image/*" capture="environment" style={{ display: 'none' }} />
                      </label>
                    </div>
                    {newStudentSchoolIdFile && <span className="text-xs text-success mt-1 truncate" style={{ color: 'var(--accent-color)' }}>Selected: {newStudentSchoolIdFile.name}</span>}
                  </div>

                  <div className="info-item">
                    <label className="text-xs text-secondary font-medium">Upload Aadhaar (Front)</label>
                    <div className="flex gap-1 mt-1">
                      <label className="btn-ghost flex-1 text-center py-2 border rounded cursor-pointer text-xs flex items-center justify-center bg-white" style={{ borderColor: 'var(--border-color)' }}>
                        <span>📁 File</span>
                        <input type="file" onChange={e => setNewStudentAadhaarFrontFile(e.target.files[0])} accept="image/*,.pdf" style={{ display: 'none' }} />
                      </label>
                      <label className="btn-ghost flex-1 text-center py-2 border rounded cursor-pointer text-xs flex items-center justify-center bg-white" style={{ borderColor: 'var(--border-color)' }}>
                        <span>📷 Cam</span>
                        <input type="file" onChange={e => setNewStudentAadhaarFrontFile(e.target.files[0])} accept="image/*" capture="environment" style={{ display: 'none' }} />
                      </label>
                    </div>
                    {newStudentAadhaarFrontFile && <span className="text-xs text-success mt-1 truncate" style={{ color: 'var(--accent-color)' }}>Selected: {newStudentAadhaarFrontFile.name}</span>}
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3 className="section-title text-sm font-bold text-accent mb-3 uppercase tracking-wider">Centre Details</h3>
                <div className="form-grid">
                  <div className="info-item">
                    <label className="text-xs text-secondary font-medium">Serial Number</label>
                    <input type="text" placeholder="e.g. 01" value={newStudentSerial} onChange={e => setNewStudentSerial(e.target.value)} />
                  </div>
                  <div className="info-item">
                    <label className="text-xs text-secondary font-medium">Centre</label>
                    <select value={newStudentCentre} onChange={e => setNewStudentCentre(e.target.value)}>
                      <option value="">Select Centre...</option>
                      {(centres || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                    <label className="text-xs text-secondary font-medium">School / Team</label>
                    <select value={newStudentSchool} onChange={e => setNewStudentSchool(e.target.value)}>
                      <option value="">Select School...</option>
                      {(schools || []).map(school => <option key={school.id} value={school.name}>{school.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3 className="section-title text-sm font-bold text-accent mb-3 uppercase tracking-wider">Contact Information</h3>
                <div className="form-grid">
                  <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                    <label className="text-xs text-secondary font-medium">Parent Name</label>
                    <input type="text" value={newStudentParentName} onChange={e => setNewStudentParentName(e.target.value)} />
                  </div>
                  <div className="info-item">
                    <label className="text-xs text-secondary font-medium">Phone</label>
                    <input type="text" value={newStudentPhone} onChange={e => setNewStudentPhone(e.target.value)} />
                  </div>
                  <div className="info-item">
                    <label className="text-xs text-secondary font-medium">Email</label>
                    <input type="email" value={newStudentEmail} onChange={e => setNewStudentEmail(e.target.value)} />
                  </div>
                  <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                    <label className="text-xs text-secondary font-medium">Address</label>
                    <input type="text" value={newStudentAddress} onChange={e => setNewStudentAddress(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-2 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                <button type="button" className="btn-ghost flex-1 border py-3" onClick={() => { setShowAddModal(false); resetStudentForm(); }}>Cancel</button>
                <button type="submit" className="btn-primary flex-1 py-3">Save Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h2 className="mb-6">Recent Sessions</h2>
            <div className="student-history-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {(history || []).map((h, i) => (
                <div key={i} className="p-4 border rounded-lg mb-2 cursor-pointer hover:border-accent" onClick={() => { setAttendanceDate(h.date); setSession(h.session); setShowHistoryModal(false); }}>
                  <div className="font-bold">{h.date}</div>
                  <div className="text-sm text-secondary">{h.session} • By {h.marked_by}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAddSchoolModal && (
        <div className="modal-overlay" onClick={() => setShowAddSchoolModal(false)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 style={{ fontSize: '1.2rem' }}>Add New School/Team</h2>
              <button className="btn-icon" onClick={() => setShowAddSchoolModal(false)}><X size={20}/></button>
            </div>
            <form onSubmit={addSchool} className="flex flex-col gap-4">
              <div className="info-item">
                <label className="text-sm font-medium">School Name</label>
                <input type="text" placeholder="Enter name" value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} required autoFocus />
              </div>
              <button type="submit" className="btn-primary w-full mt-4">Add School</button>
            </form>
          </div>
        </div>
      )}
      
      {showAddCentreModal && (
        <div className="modal-overlay" onClick={() => setShowAddCentreModal(false)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 style={{ fontSize: '1.2rem' }}>Add New Centre</h2>
              <button className="btn-icon" onClick={() => setShowAddCentreModal(false)}><X size={20}/></button>
            </div>
            <form onSubmit={addCentre} className="flex flex-col gap-4">
              <div className="info-item">
                <label className="text-sm font-medium">Centre Name</label>
                <input type="text" placeholder="e.g. Andheri Centre" value={newCentreName} onChange={e => setNewCentreName(e.target.value)} required autoFocus />
              </div>
              <button type="submit" className="btn-primary w-full mt-4">Add Centre</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
