import { useState } from 'react';
import styles from './Calendar.module.css';

interface TimeSlotPickerProps {
  selectedTime: string;
  onTimeSelect: (time: string) => void;
  defaultTimes?: string[];
}

const SUGGESTED_TIMES = [
  { time: '09:00', label: '9:00 AM' },
  { time: '11:00', label: '11:00 AM' },
  { time: '13:00', label: '1:00 PM' },
  { time: '15:00', label: '3:00 PM' },
  { time: '17:00', label: '5:00 PM' },
  { time: '19:00', label: '7:00 PM' },
  { time: '21:00', label: '9:00 PM' },
];

export function TimeSlotPicker({ 
  selectedTime, 
  onTimeSelect, 
  defaultTimes = ['11:00', '19:00'] 
}: TimeSlotPickerProps) {
  const [customTime, setCustomTime] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleCustomTimeSubmit = () => {
    if (customTime) {
      onTimeSelect(customTime);
      setShowCustomInput(false);
    }
  };

  return (
    <div className={styles.timeSlotPicker}>
      <div className={styles.timeSlotHeader}>
        <h4>Select Time</h4>
      </div>

      <div className={styles.suggestedTimes}>
        {SUGGESTED_TIMES.map(({ time, label }) => (
          <button
            key={time}
            className={`${styles.timeSlot} ${selectedTime === time ? styles.selected : ''} ${
              defaultTimes.includes(time) ? styles.recommended : ''
            }`}
            onClick={() => onTimeSelect(time)}
          >
            {label}
            {defaultTimes.includes(time) && (
              <span className={styles.recommendedBadge}>★</span>
            )}
          </button>
        ))}
      </div>

      {showCustomInput ? (
        <div className={styles.customTimeInput}>
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            className={styles.timeInput}
          />
          <button 
            onClick={handleCustomTimeSubmit}
            className={styles.confirmButton}
            disabled={!customTime}
          >
            Set
          </button>
          <button 
            onClick={() => setShowCustomInput(false)}
            className={styles.cancelButton}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button 
          className={styles.customTimeButton}
          onClick={() => setShowCustomInput(true)}
        >
          Custom time...
        </button>
      )}

      <div className={styles.optimalTimesNote}>
        <strong>💡 Optimal posting times:</strong>
        <p>Weekdays: 11am–1pm, 7pm–9pm</p>
        <p>Weekends: 10am–11am</p>
      </div>
    </div>
  );
}
