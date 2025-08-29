import React, { useState } from 'react';
import { TodoItem } from '../api';
import styles from './TodoList.module.css';

interface TodoListProps {
  todos: TodoItem[];
  summary: string;
  isVisible: boolean;
  onClose: () => void;
  isGenerating?: boolean;
}

export const TodoList: React.FC<TodoListProps> = ({
  todos,
  summary,
  isVisible,
  onClose,
  isGenerating = false
}) => {
  const [completedTodos, setCompletedTodos] = useState<Set<string>>(new Set());

  const toggleTodoComplete = (todoId: string) => {
    setCompletedTodos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(todoId)) {
        newSet.delete(todoId);
      } else {
        newSet.add(todoId);
      }
      return newSet;
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ff4757';
      case 'medium': return '#ffa726';
      case 'low': return '#66bb6a';
      default: return '#90a4ae';
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'food': return '🍽️';
      case 'text': return '📝';
      case 'people': return '👤';
      case 'furniture': return '🪑';
      case 'electronics': return '📱';
      case 'nature': return '🌿';
      case 'tools': return '🔧';
      case 'observed': return '👁️';
      default: return '🔍';
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`${styles.todoOverlay} ${isVisible ? styles.visible : ''}`}>
      <div className={styles.todoContainer}>
        <div className={styles.todoHeader}>
          <div className={styles.todoTitle}>
            <span className={styles.titleIcon}>🤖</span>
            <h3>AI Generated Todos</h3>
          </div>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            title="Close todo list"
          >
            ×
          </button>
        </div>

        <div className={styles.todoContent}>
          {isGenerating ? (
            <div className={styles.generatingState}>
              <div className={styles.spinner}></div>
              <p>Analyzing your captured frames...</p>
            </div>
          ) : (
            <>
              {summary && (
                <div className={styles.summary}>
                  <p>{summary}</p>
                </div>
              )}

              <div className={styles.todoList}>
                {todos.length === 0 ? (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>📝</span>
                    <p>No todos generated from your captures</p>
                  </div>
                ) : (
                  todos.map((todo) => (
                    <div 
                      key={todo.id} 
                      className={`${styles.todoItem} ${completedTodos.has(todo.id) ? styles.completed : ''}`}
                    >
                      <button
                        className={styles.todoCheckbox}
                        onClick={() => toggleTodoComplete(todo.id)}
                        aria-label={completedTodos.has(todo.id) ? 'Mark as not seen' : 'Mark as seen'}
                      >
                        {completedTodos.has(todo.id) ? '✓' : ''}
                      </button>

                      <div className={styles.todoDetails}>
                        <div className={styles.todoTask}>
                          {todo.task}
                        </div>
                        
                        <div className={styles.todoMeta}>
                          <span 
                            className={styles.todoPriority}
                            style={{ backgroundColor: getPriorityColor(todo.priority) }}
                          >
                            {todo.priority}
                          </span>
                          
                          {todo.category && (
                            <span className={styles.todoCategory}>
                              {getCategoryIcon(todo.category)} {todo.category}
                            </span>
                          )}
                          
                          {todo.estimated_time && (
                            <span className={styles.todoTime}>
                              ⏱️ {todo.estimated_time}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};