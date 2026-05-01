import os
import re

file_path = "index.html"
if not os.path.exists(file_path):
    print("Not found")
    exit(1)

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# For reactions
if 'deleteReaction' not in content:
    content = re.sub(
        r'(const when = reaction\.createdAt \? formatCommunityTime\(reaction\.createdAt\) : "just now";)',
        r'\1\n        const isOwner = localStorage.getItem("threadborn_user") && JSON.parse(localStorage.getItem("threadborn_user")).role === "owner";\n        const deleteBtn = isOwner ? `<button onclick="deleteReaction(\'${reaction.id}\')" style="background:none;border:none;color:red;cursor:pointer;font-size:12px;margin-left:10px;">[Delete]</button>` : "";',
        content
    )
    
    content = re.sub(
        r'(<span>\$\{rating\} \$\{category\} • \$\{when\}</span>)',
        r'\1${deleteBtn}',
        content
    )

# For community posts
if 'deleteCommunityPost' not in content:
    content = re.sub(
        r'(<div class="post-head">.*?<strong>\$\{post\.username \|\| "reader"\}\$\{renderNameBadges\(post\)\}:</strong>)',
        r'\1 ${isModerator ? `<button onclick="deleteCommunityPost(\'${post.id}\')" style="background:none;border:none;color:red;cursor:pointer;font-size:12px;float:right;">[Delete Post]</button>` : ""}',
        content,
        flags=re.DOTALL
    )

# For community comments
if 'deleteCommunityComment' not in content:
    content = re.sub(
        r'(<div class="post-comment">.*?<strong>\$\{comment\.username \|\| "reader"\}\$\{renderNameBadges\(comment\)\}:</strong>)',
        r'\1 ${isModerator ? `<button onclick="deleteCommunityComment(\'${comment.id}\')" style="background:none;border:none;color:red;cursor:pointer;font-size:12px;float:right;">[Delete]</button>` : ""}',
        content,
        flags=re.DOTALL
    )

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

with open('index-jp.html', 'w', encoding='utf-8') as f:
    # also apply to index-jp.html
    f.write(content)

print("Injected delete buttons into index files.")
