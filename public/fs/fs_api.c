#include <stdio.h>
#include <string.h>

// Simulated simple file storage
char files[5][100] = {
  "main.c",
  "main.py",
  "index.html",
  "notes.txt",
  "readme.md"
};

char contents[5][1024] = {
  "#include <stdio.h>\nint main() { printf(\"Hello C\"); return 0; }",
  "print('Hello Python')",
  "<h1>Hello from Web</h1>",
  "My personal notes...",
  "Welcome to IDEAL!"
};

int file_count = 5;

// Get total number of files
int getFileCount() { return file_count; }

// Get file name
const char* getFileName(int index) {
  if (index < 0 || index >= file_count) return "";
  return files[index];
}

// Read file content
const char* readFile(int index) {
  if (index < 0 || index >= file_count) return "";
  return contents[index];
}
