import cv2
import numpy as np

mapping_path = "../mappings/hurricane-harvey_00000003_pre_disaster_mapping.png"
pre_path = "../images/hurricane-harvey_00000003_pre_disaster.png"
post_path = "../images/hurricane-harvey_00000003_post_disaster.png"

mapping = cv2.imread(mapping_path)
pre = cv2.imread(pre_path)
post = cv2.imread(post_path)

mapping = cv2.resize(mapping, (pre.shape[1], pre.shape[0]))

# Convert to HSV
hsv = cv2.cvtColor(mapping, cv2.COLOR_BGR2HSV)

lower_blue = np.array([95, 80, 80])
upper_blue = np.array([130, 255, 255])
mask = cv2.inRange(hsv, lower_blue, upper_blue)

# Clean up mask
kernel = np.ones((3,3), np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

# Find contours
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

# Draw thin outlines
outlined_pre = pre.copy()
outlined_post = post.copy()

cv2.drawContours(outlined_pre, contours, -1, (255, 0, 0), 1)   # blue, 1px
cv2.drawContours(outlined_post, contours, -1, (255, 0, 0), 1)

cv2.imwrite("outlined_pre.png", outlined_pre)
cv2.imwrite("outlined_post.png", outlined_post)

print("Saved outlined_pre.png and outlined_post.png")