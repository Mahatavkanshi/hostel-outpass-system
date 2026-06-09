package handlers

import (
	"log"
	"time"
)

func (a *Handler) StartLateSweep() {
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			if err := a.RunLateSweep(time.Now().UTC()); err != nil {
				log.Printf("late sweep failed: %v", err)
			}
			<-ticker.C
		}
	}()
}

func (a *Handler) RunLateSweep(now time.Time) error {
	rows, err := a.DB.Query(`
		SELECT id, student_id FROM outpasses
		WHERE status = 'checked_out'
			AND expected_return_at < ?
			AND late_status != 'late'
	`, now.Format(time.RFC3339Nano))
	if err != nil {
		return err
	}
	defer rows.Close()
	type lateOutpass struct{ ID, StudentID string }
	var late []lateOutpass
	for rows.Next() {
		var item lateOutpass
		if rows.Scan(&item.ID, &item.StudentID) == nil {
			late = append(late, item)
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, item := range late {
		tx, err := a.DB.Begin()
		if err != nil {
			return err
		}
		if err := mustExec(tx, `UPDATE outpasses SET late_status = 'late', late_notified_at = ?, updated_at = ? WHERE id = ?`, nowString(), nowString(), item.ID); err != nil {
			_ = tx.Rollback()
			return err
		}
		if err := a.createNotification(tx, item.StudentID, "", "late", "You are late", "Your approved return time has passed. Request an extension or return to hostel."); err != nil {
			_ = tx.Rollback()
			return err
		}
		if err := a.createNotification(tx, "", "warden", "late", "Student late", "A checked-out student missed the return time."); err != nil {
			_ = tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}
