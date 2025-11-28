export const languageOptions = [
  {
    "language": "c",
    "version": "10.2.0",
    "aliases": [
      "gcc"
    ],
    "runtime": "gcc"
  },
  {
    "language": "c++",
    "version": "10.2.0",
    "aliases": [
      "cpp",
      "g++"
    ],
    "runtime": "gcc"
  },
  {
    "language": "java",
    "version": "15.0.2",
    "aliases": []
  },
  {
    "language": "javascript",
    "version": "18.15.0",
    "aliases": [
      "node-javascript",
      "node-js",
      "javascript",
      "js"
    ],
    "runtime": "node"
  },
  {
    "language": "python",
    "version": "3.10.0",
    "aliases": [
      "py",
      "py3",
      "python3",
      "python3.10"
    ]
  }
]

export const codeSnippets:Record<string, string> = {
  javascript: 
    "function sum(a, b) {\n  return a + b;\n}\n\nconsole.log('Sum:', sum(5, 3));",

  c: 
    "#include <stdio.h>\n\nint sum(int a, int b) {\n  return a + b;\n}\n\nint main() {\n  int result = sum(5, 3);\n  printf(\"Sum: %d\\n\", result);\n  return 0;\n}",

  "c++": 
    "#include <iostream>\nusing namespace std;\n\nint sum(int a, int b) {\n  return a + b;\n}\n\nint main() {\n  cout << \"Sum: \" << sum(5, 3) << endl;\n  return 0;\n}",

  java: 
    "public class Main {\n  static int sum(int a, int b) {\n    return a + b;\n  }\n\n  public static void main(String[] args) {\n    System.out.println(\"Sum: \" + sum(5, 3));\n  }\n}",

  python: 
    "def sum(a, b):\n    return a + b\n\nprint('Sum:', sum(5, 3))"
};

