import React, { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';

const Sessionform = () => {
    const [users, setUsers] = useState([]); //lista käyttäjistä tietokannassa
    const [subjects, setSubjects] = useState([]); //lista aineista tietokannassa
    const [userId, setUserId] = useState(''); //valitun käyttäjän id
    const [subjectId, setSubjectId] = useState(''); //valitun aineen id
    const [sessionDuration, setSessionDuration] = useState(''); //syötettävän session pituus
    const [sessions, setSessions] = useState([]); //lista viimeisistä sessioista
    const [message, setMessage] = useState(''); //näyttää errorin ja onnistumisviestin
    const [editingSession, setEditingSession] = useState(null); // editointi tila
    const [isModalOpen, setIsModalOpen] = useState(false);//modal muokkausta varten
    const openModal = () => setIsModalOpen(true); //modal auki
    const closeModal = () => setIsModalOpen(false); //modal kiinni
    const [editSubjectId, setEditSubjectId] = useState(''); // aineen id editoidessa
    const [editDuration, setEditDuration] = useState(''); // kesto tehdessä muutoksia
    const [progress, setProgress] = useState({ //edistymis data
        dailyGoal: 0,
        weeklyGoal: 0,
        totalDurationToday: 0,
        totalDurationWeek: 0,
        dailyProgress: 0,
        weeklyProgress: 0
    });

    //sessio sivut
    const [currentPage, setCurrentPage] = useState(1); //aloittaa ensimmäiseltä sivulta
    const sessionsPerPage = 10; //rajaa kymmeneen per sivu
    const [totalCount, setTotalCount] = useState(0);

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / sessionsPerPage);

    //laskee indeksit
    //const indexOfLastSession = currentPage * sessionsPerPage;
    //const indexOfFirstSession = indexOfLastSession - sessionsPerPage;
    //const currentSessions = sessions.slice(indexOfFirstSession, indexOfLastSession);

    //hakee 10 viimeisintä sessiota
    const fetchRecentSessions = useCallback((page = currentPage) => {
            fetch(`http://localhost/learning/api.php?action=getRecentSessions&page=${page}&limit=${sessionsPerPage}`)
                .then((response) => {
                    if (!response.ok) {
                        return response.text().then((errorText) => {
                            throw new Error(`Server error: ${errorText}`);
                        });
                    }
                    return response.json();
                })
                .then((data) => {
                    if (Array.isArray(data.sessions)) { //tarkastetaan ettö data sisältää odotetun sessio taulukon
                        setSessions(data.sessions);
                        setTotalCount(data.total_count); //sesioiden kokonaismäärä
                    } else {
                        throw new Error("Unexpected data format for sessions");
                    }
                })
                .catch((error) => setMessage("Error: " + error.message));
        }, [currentPage, sessionsPerPage]);


    //hakee käyttäjän päivittäisen ja viikoittaisen edistymisen
    const fetchGoalsAndProgress = useCallback(() => {
        if (!userId) return; // jos userId ei ole vielä valittu
        fetch(`http://localhost/learning/api.php?action=getDailyProgress&user_id=${userId}`)
            .then((response) => {
                if (!response.ok) {
                    return response.text().then((errorText) => {
                        throw new Error(`Server error: ${errorText}`);
                    });
                }
                return response.json();
            })
            .then((data) => {
                if (data.status === "error") {
                    setMessage(data.message || "Error fetching goals.");
                } else {
                    setProgress({
                        dailyGoal: data.daily_goal || 0, //päivittäinen tavoite, minuutteina
                        weeklyGoal: data.weekly_goal || 0, //viikoittainen tavoite, tunteina
                        totalDurationToday: data.total_duration_today || 0, //minuutteja saavutettu päivässä
                        totalDurationWeek: data.total_duration_week || 0, //minuutteja tämä viikko
                        dailyProgress: data.daily_progress || 0, //saavutettu päivittäinen prosentti osuus
                        weeklyProgress: data.weekly_progress || 0 //saavutettu viikoittainen prosentti osuus
                    });
                }
            })
            .catch((error) => setMessage("Error: " + error.message));
    }, [userId]);
    // hakee käyttäjät, aineet, viimeiset sessiot ja edistymisen
    useEffect(() => {
        fetchUsersAndSubjects();
        fetchRecentSessions();
        if (userId) {
            fetchGoalsAndProgress(); //hakee valitun käyttäjän edistymisen
        }
    }, [userId, fetchGoalsAndProgress, fetchRecentSessions]); //hakeee uudelleen jos käyttäjää vaihdetaan

    //hakee käyttäjät ja aineet pudotusvalikkoon
    const fetchUsersAndSubjects = () => {
        fetch("http://localhost/learning/api.php?action=getUsersAndSubjects")
            .then((response) => {
                if (!response.ok) {
                    return response.text().then((errorText) => {
                        throw new Error(`Server error: ${errorText}`);
                    });
                }
                return response.json();
            })
            .then((data) => {
                if (data && data.users && data.subjects) { //tarkastaa datan oikeellisuutta
                    setUsers(data.users);
                    setSubjects(data.subjects);
                } else {
                    throw new Error("Invalid data format from server");
                }
            })
            .catch((error) => setMessage("Error: " + error.message));
    };

    useEffect(() => {
        fetchUsersAndSubjects();
        fetchRecentSessions(currentPage);
    }, [currentPage, fetchRecentSessions]);
    

    // Sivunvaihto
    const handleNextPage = () => {
        if (currentPage < totalPages) {
            const newPage = currentPage + 1;
            setCurrentPage(newPage);
            fetchRecentSessions(newPage);
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            const newPage = currentPage - 1;
            setCurrentPage(newPage);
            fetchRecentSessions(newPage); //hakee aijemman sivun sessiot
        }
    };

    // uuden lisäyksen teko
    const handleSubmit = (e) => {
        e.preventDefault();

        //lähettää uuden session tietokantaan
        fetch("http://localhost/learning/api.php?action=addSession", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, subject_id: subjectId, session_duration: sessionDuration })
        })
        .then((response) => {
            if (!response.ok) {
                return response.text().then(errorText => {
                    throw new Error(`Server error: ${errorText}`);
                });
            }
            return response.json();
        })
        .then((data) => {
            if (data.status === "success") {
                setMessage("Session added successfully.");
                setSessionDuration(''); // lisäyksen jälkeen tyhjennä kesto kenttä
                fetchRecentSessions();  // päivitä session lista
                fetchGoalsAndProgress(); // päivitä edistyminen
            } else {
                setMessage(data.message || "Error adding session.");
            }
        })
        .catch((error) => setMessage("Error: " + error.message));
    };

    const handleDelete = async (sessionId) => {
        try { // lähettää pyynnön session poistoon
            const response = await fetch('http://localhost/learning/api.php?action=deleteSession', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ session_id: sessionId }),
            });
            //vastaus json muotoon
            const result = await response.json();
            console.log(result);
    
            if (result.status === 'success') {
                alert('Session deleted successfully.');
                fetchRecentSessions(); // lataa uudelleen sessiot poiston jälkeen
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    // avaa modalin jossa muuttaa sessiota
    const handleEdit = (session) => {
        setEditingSession(session); // asetetaan muokattava sessio
        setEditSubjectId(session.subject_id); // asetetaan alkuarvo aineelle
        setEditDuration(session.session_duration); // asetetaan alkuarvo kestolle
        openModal(); // näytä modal
    };

    // sulkee modalin
    const handleCloseModal = () => {
        setIsModalOpen(false); //sulkee modalin
        setEditingSession(null); //nollaa muokattava sessio
    };

    // session päivitys
    const handleEditSave = () => {
        if (!editSubjectId || !editDuration) {
            alert('Please fill in all fields'); //varsmistus että kentät täytetty
            return;
        }

            //lähettää päivitetyt tiedot
        fetch('http://localhost/learning/api.php?action=modifySession', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: editingSession.session_id, //päivittää sessio idn
                subject_id: parseInt(editSubjectId), //muokattu id aineelle
                session_duration: parseInt(editDuration), //muokattu kesto
            }),
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.status === 'success') {
                    alert('Session updated successfully!');
                    fetchRecentSessions(); // hakee päivitetyt sessiot uudelleen
                    handleCloseModal(); // sulkee modalin
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch((error) => console.error('Error updating session:', error));
    };
    
    

    return (
        <div className="learning-tracker">
            <h1>Learning Tracker</h1>

            {/* näytä onnistuminen tai error tarvittaessa */}
            {message && <p className="message">{message}</p>}

            {/* lomake uuden sessionin tekoon */}
            <form onSubmit={handleSubmit}>
                <label>User:</label>
                <select 
                    value={userId} 
                    onChange={(e) => setUserId(e.target.value)}
                    required
                    className="form-select"
                >
                    <option value="">Select User</option>
                    {users.map((user) => (
                        <option key={user.user_id} value={user.user_id}>{user.username}</option>
                    ))}
                </select>

                <label>Subject:</label>
                <select 
                    value={subjectId} 
                    onChange={(e) => setSubjectId(e.target.value)}
                    required
                    className="form-select"
                >
                    <option value="">Select Subject</option>
                    {subjects.map((subject) => (
                        <option key={subject.subject_id} value={subject.subject_id}>{subject.subject_name}</option>
                    ))}
                </select>

                <label>Session Duration (minutes):</label>
                <input 
                    type="number" 
                    value={sessionDuration} 
                    onChange={(e) => setSessionDuration(e.target.value)}
                    required
                    className="form-input"
                />

                <button type="submit">Add Session</button>
            </form>

            {/* näytä viimeiset sessiot taulukkona */}
            <div className="recent-sessions">
                <h3>Recent Sessions</h3>
                <table border="1">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Subject</th>
                            <th>Date</th>
                            <th>Duration (minutes)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.map((session) => (
                            <tr key={session.session_id}>
                                <td>{session.user_name}</td>
                                <td>{session.subject_name}</td>
                                <td>{session.session_date}</td>
                                <td>{session.session_duration}</td>
                                <td>
                                    <button onClick={() => handleEdit(session)}
                                    className="edit-button">Edit</button>
                                    <button onClick={() => handleDelete(session.session_id)}
                                    className="delete-button">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* sivu kontrollit */}
                <div className="pagination">
                    <button onClick={handlePrevPage} disabled={currentPage === 1}>
                        Previous
                    </button>
                    <span>Page {currentPage}</span>
                    <button onClick={handleNextPage} disabled={currentPage >= totalPages}>Next</button>
                </div>
            </div>

            {/* modal session muokkaukseen */}
            <Modal isOpen={isModalOpen} onClose={closeModal}>

                <div className="modal">
                    <div className="modal-content">
                        <h2>Edit Session</h2>
                        <label>Subject:</label>
                        <select
                            value={editSubjectId}
                            onChange={(e) => setEditSubjectId(e.target.value)}
                            className="form-select">
                            <option value="">Select Subject</option>
                            {subjects.map((subject) => (
                                <option
                                    key={subject.subject_id}
                                    value={subject.subject_id}>
                                    {subject.subject_name}
                                </option>
                            ))}
                        </select>

                        <label>Duration (minutes):</label>
                        <input
                            type="number"
                            value={editDuration}
                            onChange={(e) => setEditDuration(e.target.value)}
                            className="form-input"
                        />

                        <button onClick={handleEditSave}>Save Changes</button>
                        <button onClick={handleCloseModal}>Cancel</button>
                    </div>
                </div>
            </Modal>

            {/* päivittäinen ja viikoittainen edistyminen */}
            <div className="progress-section">

                {/* päivittäinen edistyminen */}
                <div className="progress">
                    <h3>Today's Progress</h3>
                    <div className="progress-bar">
                        <div 
                            className="progress-bar-fill" 
                            style={{ width: `${progress.dailyProgress}%` }}
                        />
                    </div>
                    <p>{progress.totalDurationToday} of {progress.dailyGoal} minutes completed</p>
                </div>

                {/* viikoittainen edistyminen */}
                <div className="progress">
                    <h3>Weekly Progress</h3>
                    <div className="progress-bar">
                        <div 
                            className="progress-bar-fill" 
                            style={{ width: `${progress.weeklyProgress}%` }} />
                    </div>
                    <p>{(progress.totalDurationWeek / 60).toFixed(2)} of {progress.weeklyGoal} hours completed</p>
                </div>
            </div>
        </div>
    );
};

export default Sessionform;
