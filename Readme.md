# A social media api

Implements all the necessary bits and pieces of fundamental backend development

**Before looking at the project I would suggest look at the [design document](./Design_Document.md)
I made That will give you a good idea of what I am trying to achieve with this project.
It also has a lot of information about the design decisions I made.**

- [x] Users
- [x] Images
- [x] Posts
- [x] Likes
- [x] Comments
- [ ] Notifications

Before running the project make sure to create a `.env` file in the root directory with the required environment variables. refer to the `.env.example` file for the required variables.

Requirements:

- Postgres
- Redis

I will be creating a seeder which will seed the database with some dummy data (in millions probably).

Just for the fun I will also be creating a frontend for this project
Will recreate this in Golang too

#### API Endpoints:

Authentication:

- Signup: `POST /auth/signup`
- Signin: `POST /auth/signin`

Users:

- Get Me: `GET /users/me`
- Update Me: `PATCH /users/me`

Posts:

- Get All Posts: `GET /posts`
- Create Post: `POST /posts`
- Get Post: `GET /posts/:id`
- Update Post: `PATCH /posts/:id`
- Delete Post: `DELETE /posts/:id`

Likes:

- Like Post: `POST /likes/:postId`
- Unlike Post: `DELETE /likes/:postId`

Comments:

- Get Comments: `GET /comments/:postId`
- Create Comment: `POST /comments/:postId`
- delete Comment: `DELETE /comments/:commentId`
