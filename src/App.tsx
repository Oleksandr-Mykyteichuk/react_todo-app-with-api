/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';

import { UserWarning } from './UserWarning';
import {
  getTodos,
  addTodos,
  deleteTodos,
  USER_ID,
  updateTodos,
} from './api/todos';
import { Todo } from './types/Todo';
import { TodoHeader } from './components/TodoHeader';
import { TodoList } from './components/TodoList';
import { TodoFooter } from './components/TodoFooter';

enum Errors {
  Load = 'Unable to load todos',
  Empty = 'Title should not be empty',
  Add = 'Unable to add a todo',
  Delete = 'Unable to delete a todo',
  Update = 'Unable to update a todo',
}

export enum Filter {
  all = 'All',
  completed = 'Completed',
  active = 'Active',
}

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [filterMethod, setFilterMethod] = useState(Filter.all);
  const [addingTodo, setAddingTodo] = useState<Todo | null>(null);
  const [deletTodo, setDeletTodo] = useState<number | null>(null);
  const [deletingTodosId, setDeletingTodosId] = useState<number[]>([]);
  const [todoChange, setTodoChange] = useState<number[]>([]);
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const todoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadTodo = async () => {
      try {
        const todo = await getTodos();

        setTodos(todo);
      } catch (error) {
        setErrorMessage(Errors.Load);
      } finally {
        setIsLoading(false);
      }
    };

    loadTodo();
  }, []);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage('');
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const handleAddTodo = useCallback(async (title: string) => {
    if (!title.trim()) {
      setErrorMessage(Errors.Empty);

      return;
    }

    const newTodo = {
      id: 0,
      title: title.trim(),
      completed: false,
      userId: USER_ID,
    };

    setAddingTodo(newTodo);

    try {
      const addedTodo = await addTodos(newTodo);

      setTodos(prev => [...prev, addedTodo]);
    } catch (e) {
      setErrorMessage(Errors.Add);
      throw e;
    } finally {
      setAddingTodo(null);
    }
  }, []);

  useEffect(() => {
    todoInputRef.current?.focus();
  }, [todos]);

  const handleDeleteTodo = useCallback(async (todoId: number) => {
    setDeletTodo(todoId);
    try {
      await deleteTodos(todoId);
      setTodos(prev => prev.filter(todo => todo.id !== todoId));
    } catch (e) {
      setErrorMessage(Errors.Delete);
    } finally {
      setDeletTodo(null);
    }
  }, []);

  const handleDeletingCompleted = useCallback(async () => {
    const completedTodos = todos.filter(todo => todo.completed);
    const completedId = completedTodos.map(todo => todo.id);

    setDeletingTodosId(id => [...id, ...completedId]);

    try {
      const result = await Promise.allSettled(completedId.map(deleteTodos));
      const successId = completedTodos
        .filter((todo, index) => result[index].status === 'fulfilled')
        .map(todo => todo.id);

      if (result.some(a => a.status === 'rejected')) {
        setErrorMessage(Errors.Delete);
      }

      if (successId.length > 0) {
        setTodos(t => t.filter(todo => !successId.includes(todo.id)));
      }
    } catch (e) {
      setErrorMessage(Errors.Delete);
    } finally {
      setDeletingTodosId(prev => prev.filter(id => !completedId.includes(id)));
    }
  }, [todos]);

  const handleUpdateTodo = useCallback(
    async (todoId: number, data: Partial<Todo>) => {
      setTodoChange(prev => [...prev, todoId]);
      try {
        const updatedTodo = await updateTodos(todoId, data);

        setTodos(prev =>
          prev.map(todo => (todo.id === todoId ? updatedTodo : todo)),
        );
      } catch (e) {
        setErrorMessage(Errors.Update);
      } finally {
        setTodoChange(prev => prev.filter(id => id !== todoId));
      }
    },
    [],
  );

  const handleToggleAll = useCallback(async () => {
    const allCompleted = todos.every(todo => todo.completed);
    const newStatus = !allCompleted;
    const todosToUpdate = todos.filter(todo => todo.completed !== newStatus);
    const updatingIds = todosToUpdate.map(todo => todo.id);

    setTodoChange(prev => [...prev, ...updatingIds]);

    try {
      const updatePromises = todosToUpdate.map(todo =>
        updateTodos(todo.id, { completed: newStatus }),
      );
      const results = await Promise.allSettled(updatePromises);
      const successfulUpdates = results
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<Todo>).value);

      setTodos(prevTodos =>
        prevTodos.map(todo => {
          const updated = successfulUpdates.find(t => t.id === todo.id);

          return updated || todo;
        }),
      );

      if (results.some(result => result.status === 'rejected')) {
        setErrorMessage(Errors.Update);
      }
    } catch (e) {
      setErrorMessage(Errors.Update);
    } finally {
      setTodoChange(prev => prev.filter(id => !updatingIds.includes(id)));
    }
  }, [todos]);

  const handleEditSubmit = useCallback(
    async (id: number, title: string) => {
      const trimmedTitle = title.trim();
      const originalTodo = todos.find(t => t.id === id);

      if (trimmedTitle === '') {
        try {
          setDeletTodo(id);
          await deleteTodos(id);
          setTodos(prev => prev.filter(todo => todo.id !== id));
          setEditingTodoId(null);
        } catch (e) {
          setErrorMessage(Errors.Delete);
        } finally {
          setDeletTodo(null);
        }

        return;
      }

      if (originalTodo && trimmedTitle === originalTodo.title) {
        setEditingTodoId(null);

        return;
      }

      setTodoChange(prev => [...prev, id]);

      try {
        const updatedTodo = await updateTodos(id, { title: trimmedTitle });

        setTodos(prev => prev.map(t => (t.id === id ? updatedTodo : t)));
        setEditingTodoId(null);
      } catch (e) {
        setErrorMessage(Errors.Update);
      } finally {
        setTodoChange(prev => prev.filter(todoId => todoId !== id));
      }
    },
    [todos],
  );

  const handleStartEditing = useCallback((id: number, title: string) => {
    setEditingTodoId(id);
    setEditingTitle(title);
  }, []);

  const handleEditCancel = useCallback(() => {
    setEditingTodoId(null);
  }, []);

  const getFilteredTodos = useCallback((tod: Todo[], query: string): Todo[] => {
    let filteredTodo = [...tod];

    switch (query) {
      case Filter.active:
        filteredTodo = filteredTodo.filter(todo => todo.completed === false);
        break;
      case Filter.completed:
        filteredTodo = filteredTodo.filter(todo => todo.completed === true);
        break;
    }

    return filteredTodo;
  }, []);

  const todoToRender = addingTodo ? [...todos, addingTodo] : todos;
  const filteredTodo = getFilteredTodos(todoToRender, filterMethod);
  const itemsLeft = todos.filter(todo => !todo.completed).length;

  if (!USER_ID) {
    return <UserWarning />;
  }

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>
      <div className="todoapp__content">
        <TodoHeader
          todos={todos}
          onAddTodo={handleAddTodo}
          onToggleAll={handleToggleAll}
          isLoading={isLoading}
          isAddingTodo={addingTodo !== null}
          todoInputRef={todoInputRef}
        />

        <TodoList
          todos={filteredTodo}
          onUpdateTodo={handleUpdateTodo}
          onDeleteTodo={handleDeleteTodo}
          onStartEditing={handleStartEditing}
          onEditSubmit={handleEditSubmit}
          onEditCancel={handleEditCancel}
          editingTodoId={editingTodoId}
          editingTitle={editingTitle}
          setEditingTitle={setEditingTitle}
          todoChange={todoChange}
          deletingTodosId={deletingTodosId}
          deletTodo={deletTodo}
        />

        {todos.length > 0 && (
          <TodoFooter
            todos={todos}
            filterMethod={filterMethod}
            onFilterChange={setFilterMethod}
            onClearCompleted={handleDeletingCompleted}
            itemsLeft={itemsLeft}
          />
        )}
      </div>

      <div
        data-cy="ErrorNotification"
        className={classNames(
          'notification is-danger is-light has-text-weight-normal',
          { hidden: !errorMessage },
        )}
      >
        <button
          data-cy="HideErrorButton"
          type="button"
          className="delete"
          onClick={() => setErrorMessage('')}
        />
        {errorMessage}
      </div>
    </div>
  );
};
