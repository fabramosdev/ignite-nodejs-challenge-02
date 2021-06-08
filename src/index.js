const express = require('express');
const cors = require('cors');

const { v4: uuidv4, validate } = require('uuid');

const app = express();
app.use(express.json());
app.use(cors());

const users = [];

/**
 * @returns Esse middleware é responsável por receber o username do usuário pelo header e validar se existe ou não um usuário com o username passado. Caso exista, o usuário deve ser repassado para o request e a função next deve ser chamada.
 */
function checksExistsUserAccount(request, response, next) {
  // Pegando o username que veio pelo header da aplicação
  const { username } = request.headers;

  // Verificando se o username passado no header existe no array de users
  const user = users.find(user => user.username === username)

  // Se NÃO existir, retornar erro 404
  if (!user) {
    return response.status(404).json({ error: 'User not found' })
  }

  // Atribuindo o usuario ao request
  request.user = user;

  // Passando para frente com middleware
  return next()

}

/**
 * @returns Esse middleware é responsável por receber o username do usuário pelo header e validar se existe ou não um usuário com o username passado. Caso exista, o usuário deve ser repassado para o request e a função next deve ser chamada.
 */
function checksCreateTodosUserAvailability(request, response, next) {
  // Pegando user do request
  const { user } = request;

  /**
   * Se nao for PRO e:
   * os TODOS forem menores que 10 OU :
   * o user for PRO, passe para frente via middleware
   */

  if ((user.pro === false && user.todos.length < 10) || user.pro === true) {
    return next();
  }

  return response.status(403).json({ error: 'Free plan limit reached. Please upgrade to pro.' });
}

/**
 * @returns Esse middleware deve receber o **username** de dentro do header e o **id** de um *todo* de dentro de `request.params`. Você deve validar o usuário, validar que o `id` seja um uuid e também validar que esse `id` pertence a um *todo* do usuário informado.

Com todas as validações passando, o *todo* encontrado deve ser passado para o `request` assim como o usuário encontrado também e a função next deve ser chamada.
 */
function checksTodoExists(request, response, next) {
  const { username } = request.headers;
  const { id } = request.params;

  const user = users.find((user) => {
    return user.username === username
  });

  if (!user) {
    return response.status(404).json({ error: 'User not found.' });
  }

  if (!validate(id)) {
    return response.status(400).json({ error: 'The provided id is not a uuid.' });
  }

  const todo = user.todos.find((todo) => {
    return todo.id === id
  });

  if (!todo) {
    return response.status(404).json({ error: "User's todo not found." });
  }

  request.todo = todo;
  request.user = user;

  return next();
}

/**
 * Esse middleware possui um funcionamento semelhante ao middleware checksExistsUserAccount mas a busca pelo usuário deve ser feita através do id de um usuário passado por parâmetro na rota. Caso o usuário tenha sido encontrado, o mesmo deve ser repassado para dentro do request.user e a função next deve ser chamada.
 */
function findUserById(request, response, next) {
  const { id } = request.params;

  const user = users.find((user) => {
    return user.id === id
  });

  if (!user) {
    return response.status(404).json({ error: 'User not found.' });
  }

  request.user = user;

  return next();


}

app.post('/users', (request, response) => {
  const { name, username } = request.body;

  const usernameAlreadyExists = users.some((user) => user.username === username);

  if (usernameAlreadyExists) {
    return response.status(400).json({ error: 'Username already exists' });
  }

  const user = {
    id: uuidv4(),
    name,
    username,
    pro: false,
    todos: []
  };

  users.push(user);

  return response.status(201).json(user);
});

app.get('/users/:id', findUserById, (request, response) => {
  const { user } = request;

  return response.json(user);
});

app.patch('/users/:id/pro', findUserById, (request, response) => {
  const { user } = request;

  if (user.pro) {
    return response.status(400).json({ error: 'Pro plan is already activated.' });
  }

  user.pro = true;

  return response.json(user);
});

app.get('/todos', checksExistsUserAccount, (request, response) => {
  const { user } = request;

  return response.json(user.todos);
});

app.post('/todos', checksExistsUserAccount, checksCreateTodosUserAvailability, (request, response) => {
  const { title, deadline } = request.body;
  const { user } = request;

  const newTodo = {
    id: uuidv4(),
    title,
    deadline: new Date(deadline),
    done: false,
    created_at: new Date()
  };

  user.todos.push(newTodo);

  return response.status(201).json(newTodo);
});

app.put('/todos/:id', checksTodoExists, (request, response) => {
  const { title, deadline } = request.body;
  const { todo } = request;

  todo.title = title;
  todo.deadline = new Date(deadline);

  return response.json(todo);
});

app.patch('/todos/:id/done', checksTodoExists, (request, response) => {
  const { todo } = request;

  todo.done = true;

  return response.json(todo);
});

app.delete('/todos/:id', checksExistsUserAccount, checksTodoExists, (request, response) => {
  const { user, todo } = request;

  const todoIndex = user.todos.indexOf(todo);

  if (todoIndex === -1) {
    return response.status(404).json({ error: 'Todo not found' });
  }

  user.todos.splice(todoIndex, 1);

  return response.status(204).send();
});

module.exports = {
  app,
  users,
  checksExistsUserAccount,
  checksCreateTodosUserAvailability,
  checksTodoExists,
  findUserById
};