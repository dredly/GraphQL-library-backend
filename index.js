if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const mongoose = require("mongoose");
const { ApolloServer, gql } = require("apollo-server");
const { v1: uuid } = require("uuid");
let { authors, books } = require("./startingData");
const Book = require("./models/book");
const Author = require("./models/author");

const MONGODB_URI = process.env.MONGODB_URI;
console.log("Connecting to", MONGODB_URI);

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB!");
  })
  .catch((err) => {
    console.log("Error connecting to mongodb", err.message);
  });

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
    author: Author!
    id: ID!
    genres: [String]!
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks: [Book!]!
    allAuthors: [Author!]!
  }

  type Mutation {
    addBook(
      title: String!
      author: String!
      published: Int!
      genres: [String]!
    ): Book
    editAuthor(name: String!, setBornTo: Int!): Author
  }
`;

const resolvers = {
  Query: {
    bookCount: async () => Book.collection.countDocuments(),
    authorCount: async () => Author.collection.countDocuments(),
    allBooks: async () => {
      const foundBooks = await Book.find({}).populate("author");
      console.log(foundBooks);
      return foundBooks;
    },
    allAuthors: async () => {
      const foundAuthors = await Author.find({});
      return foundAuthors;
    },
  },
  Mutation: {
    addBook: async (root, args) => {
      // See if author already exists in the database
      let authorId = null;
      const foundAuthor = await Author.findOne({ name: args.author });
      if (!foundAuthor) {
        const author = new Author({
          name: args.author,
        });
        const savedAuthor = await author.save();
        authorId = savedAuthor._id.toString();
      } else {
        authorId = foundAuthor._id.toString();
      }
      const book = new Book({ ...args, author: authorId });
      await book.save();
      return book;
    },
    editAuthor: (root, args) => {
      const foundAuthor = authors.find((a) => a.name === args.name);
      if (!foundAuthor) return null;
      const updatedAuthor = { ...foundAuthor, born: args.setBornTo };
      authors = authors.map((a) => (a.name === args.name ? updatedAuthor : a));
      return updatedAuthor;
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
