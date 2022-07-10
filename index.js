const { ApolloServer, gql } = require("apollo-server");
const { v1: uuid } = require("uuid");
let { authors, books } = require("./startingData");

const typeDefs = gql`
  type Author {
    name: String!
    id: ID!
    born: Int
    bookCount: Int!
  }

  type Book {
    title: String!
    published: Int!
    author: String!
    id: ID!
    genres: [String]!
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
  }

  type Mutation {
    addBook(
      title: String!
      author: String!
      published: Int!
      genres: [String]!
    ): Book
  }
`;

const resolvers = {
  Query: {
    bookCount: () => books.length,
    authorCount: () => authors.length,
    allBooks: (root, args) => {
      if (!args.author && !args.genre) {
        return books;
      }
      if (!args.genre) {
        const booksByAuthor = books.filter((b) => b.author === args.author);
        return booksByAuthor;
      }
      if (!args.author) {
        const booksByGenre = books.filter((b) => b.genres.includes(args.genre));
        return booksByGenre;
      }
      const booksByAuthor = books.filter((b) => b.author === args.author);
      return booksByAuthor.filter((b) => b.genres.includes(args.genre));
    },
    allAuthors: () => {
      return authors.map((a) => {
        const bookCount = books.filter((b) => b.author === a.name).length;
        return { ...a, bookCount };
      });
    },
  },
  Mutation: {
    addBook: (root, args) => {
      const book = { ...args, id: uuid() };
      books = books.concat(book);
      // Add a new author if this author does not already exist
      // in the data
      if (!authors.find((a) => a.name === book.author)) {
        const author = {
          name: book.author,
          id: uuid(),
          born: null,
          bookCount: 1,
        };
        authors = authors.concat(author);
      }
      return book;
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});
